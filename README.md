# Hapi Airtable Authentication Plugin

A plugin that adds JWT-based authentication to a Hapi server, utilizing Airtable as a data store. It will trigger a callback function with a verification callback url that can be used to send an email with a "magic link" style confirmation button.

## Usage

Register the plugin with your Hapi server by doing the following:

```
await server.register({
  plugin: require("hapi-airtable-authentication-plugin"),
  options: {
    airtableBase: AIRTABLE_BASE,
    airtableApiToken: AIRTABLE_API_TOKEN,
    jwtSecret: JWT_SECRET,
    apiUrl: API_URL,
    verifyCallback: ({ email, verificationUrl, loginCode }) => {}
  }
});
```

In Airtable, you must have a table called `Users`, with the following columns:

- `email`, of type Email
- `login_code`, of type Single line text
- `email_confirmed`, of type Checkbox

The following three routes will be added to your server:

- `/verify` - Generates a JWT token and triggers the first step in the authentication process, calling `verifyCallback`. The following query parameters are required:
  - email - The email address of the authenticating user
  - linkingUri - The linking URI the user will be redirected to after sign in confirmation.
- `/confirm` - The route hit when the user navigates to the `verificationUrl` passed in `verifyCallback`. The user will be redirected to the `linkingUri` passed in the previous step, along with `userId` and `token` query params. The following query parameters are required, and are already included in the `verificationUrl` returned in the previous step:
  - `token`
  - `linkingUri`
- `/confirm-code` - This endpoint exists to support the user manually entering the five digit code returned in `verifyCallback`, rather than clicking the "magic link" sent in the email. The following query paramters are required:
  - `email` - The user's email address
  - `code` - The five digit code returned in `verifyCallback`

## Options

All options are required.

- `airtableBase` - The ID of the Airtable Base you wish to interact with
- `airtableApiToken` - Your Airtable API key
- `jwtSecret` - A string containing the secret for the HMAC algorithm. [See jsonwebtoken docs](https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback) for more information
- `apiUrl` - The URL that the Hapi server is public accessible from. This will be used to generate the callback URL
- `verifyCallbacak` - A function that accepts an object with `email`, `verificationUrl`, and `loginCode` keys. This is called after `/verify` is called
