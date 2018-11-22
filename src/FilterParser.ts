// @ts-ignore
import { Ber, BerReader, BerWriter } from 'asn1';
import { Filter } from './filters/Filter';
import { PresenceFilter } from './filters/PresenceFilter';
import { AndFilter } from './filters/AndFilter';
import { GreaterThanEqualsFilter } from './filters/GreaterThanEqualsFilter';
import { ExtensibleFilter, ExtensibleFilterOptions } from './filters/ExtensibleFilter';
import { NotFilter } from './filters/NotFilter';
import { SubstringFilter } from './filters/SubstringFilter';
import { EqualityFilter } from './filters/EqualityFilter';
import { ApproximateFilter } from './filters/ApproximateFilter';
import { OrFilter } from './filters/OrFilter';
import { LessThanEqualsFilter } from './filters/LessThanEqualsFilter';
import { SearchFilter } from './SearchFilter';

interface ParseStringResult {
  end: number;
  filter: Filter;
}

interface Substring {
  initial: string;
  any: string[];
  final: string;
}

export class FilterParser {
  public static parseString(filterString: string): Filter {
    if (!filterString) {
      throw new Error('Filter cannot be empty');
    }

    if (filterString.charAt(0) !== '(') {
      // tslint:disable-next-line:no-parameter-reassignment
      filterString = `(${filterString})`;
    }

    const parseResult = FilterParser._parseString(filterString, 0);
    const end = filterString.length - 1;
    if (parseResult.end < end) {
      throw new Error('Unbalanced parens');
    }

    return parseResult.filter;
  }

  /*
   * A filter looks like this coming in:
   *      Filter ::= CHOICE {
   *              and             [0]     SET OF Filter,
   *              or              [1]     SET OF Filter,
   *              not             [2]     Filter,
   *              equalityMatch   [3]     AttributeValueAssertion,
   *              substrings      [4]     SubstringFilter,
   *              greaterOrEqual  [5]     AttributeValueAssertion,
   *              lessOrEqual     [6]     AttributeValueAssertion,
   *              present         [7]     AttributeType,
   *              approxMatch     [8]     AttributeValueAssertion,
   *              extensibleMatch [9]     MatchingRuleAssertion --v3 only
   *      }
   *
   *      SubstringFilter ::= SEQUENCE {
   *              type               AttributeType,
   *              SEQUENCE OF CHOICE {
   *                      initial          [0] IA5String,
   *                      any              [1] IA5String,
   *                      final            [2] IA5String
   *              }
   *      }
   *
   * The extensibleMatch was added in LDAPv3:
   *
   *      MatchingRuleAssertion ::= SEQUENCE {
   *              matchingRule    [1] MatchingRuleID OPTIONAL,
   *              type            [2] AttributeDescription OPTIONAL,
   *              matchValue      [3] AssertionValue,
   *              dnAttributes    [4] BOOLEAN DEFAULT FALSE
   *      }
   */
  public static parse(reader: BerReader): Filter {
    const type: SearchFilter = reader.readSequence();

    let filter: Filter;
    switch (type) {
      case SearchFilter.and:
        const andFilters = FilterParser._parseSet(reader);
        filter = new AndFilter({
          filters: andFilters,
        });
        break;
      case SearchFilter.approxMatch:
        filter = new ApproximateFilter();
        filter.parse(reader);
        break;
      case SearchFilter.equalityMatch:
        filter = new EqualityFilter();
        filter.parse(reader);
        break;
      case SearchFilter.extensibleMatch:
        filter = new ExtensibleFilter();
        filter.parse(reader);
        break;
      case SearchFilter.greaterOrEqual:
        filter = new GreaterThanEqualsFilter();
        filter.parse(reader);
        break;
      case SearchFilter.lessOrEqual:
        filter = new LessThanEqualsFilter();
        filter.parse(reader);
        break;
      case SearchFilter.not:
        const innerFilter = FilterParser.parse(reader);
        filter = new NotFilter({
          filter: innerFilter,
        });
        break;
      case SearchFilter.or:
        const orFilters = FilterParser._parseSet(reader);
        filter = new OrFilter({
          filters: orFilters,
        });
        break;
      case SearchFilter.present:
        filter = new PresenceFilter();
        filter.parse(reader);
        break;
      case SearchFilter.substrings:
        filter = new SubstringFilter();
        filter.parse(reader);
        break;
      default:
        throw new Error(`Invalid search filter type: 0x${type}`);
    }

    return filter;
  }

  private static _parseString(filterString: string, start: number): ParseStringResult {
    let cursor = start;
    const length = filterString.length;
    let filter: Filter;

    if (filterString[cursor] !== '(') {
      throw new Error(`Missing paren: ${filterString}`);
    }

    cursor += 1;
    switch (filterString[cursor]) {
      case '&': {
        cursor += 1;
        const children: Filter[] = [];
        while (cursor < length && filterString[cursor] !== ')') {
          const childResult = FilterParser._parseString(filterString, cursor);
          children.push(childResult.filter);
          cursor = childResult.end + 1;
        }

        filter = new AndFilter({
          filters: children,
        });

        break;
      }
      case '|': {
        cursor += 1;
        const children: Filter[] = [];
        while (cursor < length && filterString[cursor] !== ')') {
          const childResult = FilterParser._parseString(filterString, cursor);
          children.push(childResult.filter);
          cursor = childResult.end + 1;
        }

        filter = new OrFilter({
          filters: children,
        });

        break;
      }
      case '!': {
        const childResult = FilterParser._parseString(filterString, cursor + 1);
        filter = new NotFilter({
          filter: childResult.filter,
        });
        cursor = childResult.end + 1;

        break;
      }
      default: {
        const end = filterString.indexOf(')', cursor);
        if (end === -1) {
          throw new Error(`Unbalanced parens: ${filterString}`);
        }

        filter = FilterParser._parseExpressionFilterFromString(filterString.substr(cursor, end - cursor));
        cursor = end;
      }
    }

    return {
      end: cursor,
      filter,
    };
  }

  private static _parseExpressionFilterFromString(filterString: string): Filter {
    let attribute: string;
    let remainingExpression: string;

    if (filterString[0] === ':') {
      // An extensible filter can have no attribute name (Only valid when using dn and * matching-rule evaluation)
      attribute = '';
      remainingExpression = filterString;
    } else {
      const matches = filterString.match(/^[-\w]+/);
      if (matches && matches.length) {
        attribute = matches[0];
        remainingExpression = filterString.substr(attribute.length);
      } else {
        throw new Error(`Invalid attribute name: ${filterString}`);
      }
    }

    if (remainingExpression === '=*') {
      return new PresenceFilter({
        attribute,
      });
    }

    if (remainingExpression[0] === '=') {
      remainingExpression = remainingExpression.substr(1);
      if (remainingExpression.indexOf('*') !== -1) {
        const escapedExpression = FilterParser._escapeSubstring(remainingExpression);
        return new SubstringFilter({
          attribute,
          initial: escapedExpression.initial,
          any: escapedExpression.any,
          final: escapedExpression.final,
        });
      }

      return new EqualityFilter({
        attribute,
        value: FilterParser._escapeValue(remainingExpression),
      });
    }

    if (remainingExpression[0] === '>' && remainingExpression[1] === '=') {
      return new GreaterThanEqualsFilter({
        attribute,
        value: FilterParser._escapeValue(remainingExpression.substr(2)),
      });
    }

    if (remainingExpression[0] === '<' && remainingExpression[1] === '=') {
      return new LessThanEqualsFilter({
        attribute,
        value: FilterParser._escapeValue(remainingExpression.substr(2)),
      });
    }

    if (remainingExpression[0] === '~' && remainingExpression[1] === '=') {
      return new ApproximateFilter({
        attribute,
        value: FilterParser._escapeValue(remainingExpression.substr(2)),
      });
    }

    if (remainingExpression[0] === ':') {
      return FilterParser._parseExtensibleFilterFromString(remainingExpression);
    }

    throw new Error(`Invalid expression: ${filterString}`);
  }

  private static _parseExtensibleFilterFromString(filterString: string): ExtensibleFilter {
    let dnAttributes: boolean = false;
    let rule: string | undefined;

    const fields = filterString.split(':');
    if (fields.length <= 1) {
      throw new Error(`Invalid extensible filter: ${filterString}`);
    }

    // Remove first entry, since it should be empty
    fields.shift();

    if (fields[0].toLowerCase() === 'dn') {
      dnAttributes = true;
      fields.shift();
    }

    if (fields.length && fields[0][0] !== '=') {
      rule = fields.shift();
    }

    if (fields.length && fields[0][0] !== '=') {
      throw new Error(`Missing := in extensible filter: ${filterString}`);
    }

    // Trim the leading = (from the :=) and reinsert any extra ':' characters
    const remainingExpression = fields.join(':').substr(1);
    const options: ExtensibleFilterOptions = {
      dnAttributes,
      rule,
      value: FilterParser._escapeValue(remainingExpression),
    };

    // TODO: Enable this if it's useful
    // if (remainingExpression.indexOf('*') !== -1) {
    //   const substring = FilterParser._escapeSubstring(remainingExpression);
    //   options.initial = substring.initial;
    //   options.any = substring.any;
    //   options.final = substring.final;
    // }

    return new ExtensibleFilter(options);
  }

  private static _escapeValue(input: string): string {
    let index: number = 0;
    const end = input.length;
    let result: string = '';

    while (index < end) {
      const char = input[index];
      switch (char) {
        case '(':
          throw new Error(`Illegal unescaped character: ${char}`);
        case '\\': {
          const value = input.substr(index + 1, 2);
          if (value.match(/^[a-fA-F0-9]{2}$/) === null) {
            throw new Error(`Invalid escaped hex character: ${value}`);
          }

          result += String.fromCharCode(Number.parseInt(value, 16));
          index += 3;

          break;
        }
        default:
          result += char;
          index += 1;
          break;
      }
    }

    return result;
  }

  private static _escapeSubstring(input: string): Substring {
    const fields = input.split('*');
    if (fields.length < 2) {
      throw new Error(`Wildcard missing: ${input}`);
    }

    return {
      initial: FilterParser._escapeValue(fields.shift() || ''),
      final: FilterParser._escapeValue(fields.pop() || ''),
      any: fields.map(FilterParser._escapeValue),
    };
  }

  private static _parseSet(reader: BerReader): Filter[] {
    const filters: Filter[] = [];
    const end = reader.offset + reader.length;
    while (reader.offset < end) {
      filters.push(FilterParser.parse(reader));
    }

    return filters;
  }
}
