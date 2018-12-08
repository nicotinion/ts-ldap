### 1.1.1

  * Add original string to error message when parsing filters
  * Adjust parsing & and | in filters
  * Add more filter parsing tests 

### 1.1.0

  * Add client.add() and client.modify() 

### 1.0.6

  * Use hex for message type code in closed message error message
  * Add additional test for calling unbind() multiple times

### 1.0.5

  * Add message name to error message when socket is closed before message response

### 1.0.4

  * Add type definitions for asn1
  * Add message type id to error when cleaning pending messages.
  * Force protocolOperation to be defined for Message types

### 1.0.3

  * Verify the socket exists before sending unbind message

### 1.0.2

  * Setup prepublish to always build.
  * Push fix from 1.0.1

### 1.0.1

  * Fix search to return attribute values by default

### 1.0.0

  * Initial release
