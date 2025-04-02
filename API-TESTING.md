# API Testing Documentation

This document describes how to use the OpenAPI specification and StepCI tests for the Feathers PubSub Queue API.

## OpenAPI Specification

The `openapi.yaml` file contains the complete API specification for the queue service. It defines:

- Request/response schemas
- Endpoint documentation
- Error responses
- Data validation rules

### Viewing the API Documentation

You can view the API documentation using tools like:

1. Swagger UI:

```bash
npx swagger-ui-express openapi.yaml
```

2. Redoc:

```bash
npx redoc-cli serve openapi.yaml
```

## StepCI Tests

The `stepci.yaml` file contains automated tests for the queue service. These tests verify:

- Basic message creation
- Priority handling
- Message scheduling
- Error cases
- Response validation

### Running the Tests

1. Install StepCI:

```bash
npm install -g stepci
```

2. Run the tests:

```bash
stepci run stepci.yaml
```

### Test Cases

The test suite includes:

1. **Create Basic Queue Message**

   - Tests basic message creation
   - Validates response structure
   - Checks status code

2. **Create High Priority Message**

   - Tests priority handling
   - Verifies priority level is set correctly

3. **Create Scheduled Message**

   - Tests message scheduling
   - Validates scheduled time

4. **Create Message with Invalid Service**

   - Tests error handling for non-existent services
   - Verifies error response format

5. **Create Message with Invalid Action**
   - Tests error handling for invalid actions
   - Verifies error response format

### Environment Variables

The tests use the following environment variables:

- `baseUrl`: The base URL of the API (defaults to http://localhost:3031)

### Customizing Tests

You can modify the tests by:

1. Adding new test cases to `stepci.yaml`
2. Modifying validation rules
3. Adding custom environment variables
4. Extending the test coverage

## Integration with CI/CD

To integrate these tests into your CI/CD pipeline:

1. Add the test files to your repository
2. Install StepCI in your CI environment
3. Run the tests as part of your build process

Example GitHub Actions workflow:

```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install StepCI
        run: npm install -g stepci
      - name: Run API Tests
        run: stepci run stepci.yaml
```
