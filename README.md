Hookflash Services Example Stack - Customer oAuth
=================================================

To integrate with Hookflash services using the oAuth approach you need:

  * An **oAuth Server** that you hookup to your user database
  * A **Contacts API** that you hookup to your user database


Create Account
--------------

Email support@hookflash.com to request a **oAuth Identity Provider Sandbox**.


Setup services
--------------

### oAuth Server

For a sample NodeJS-based oAuth provider hooked up to a local MySQL
database see: `/services/example/oauth.nodejs`

  * oAuth Server URLs:
    * `:81/authorize?response_type=code&redirect_uri=<URL>&client_id=<CLIENT_ID>`
    * `:81/token` with client credentials in the request body as dictated by OAuth 2.0 spec or using HTTP basic authentication.
    * `:81/profile` with a [bearer token](http://tools.ietf.org/html/rfc6750)

### Contacts API

For a sample NodeJS-based contacts API that integrates with the
sample NodeJS-base oAuth provider and is connected to the
local MySQL database see: `services/example/contacts.nodejs`

  * Cpntacts Server URLs:
    * `:82/contacts?access_token=<OAUTH_ACCESS_TOKEN>`


Test against Sandbox
--------------------

Go to the sandbox at [http://fly.hookflash.me/providers](fly.hookflash.me/providers) and follow instructions.

