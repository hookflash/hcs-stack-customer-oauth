Hookflash Services Example Stack - Customer oAuth
=================================================

To integrate with Hookflash services using the oAuth approach you need:

  * An **oAuth Server** that you hookup to your user database
  * A **Contacts API** that you hookup to your user database


Create Account
--------------

Create account at: http://fly.hookflash.me

Naviagte to [http://fly.hookflash.me/providers](fly.hookflash.me/providers) and request your own **oAuth Identity Provider Sandbox**.

You will be given further setup instructions at [http://fly.hookflash.me/providers](fly.hookflash.me/providers) once your sandbox request is approved.


Setup services
--------------

### oAuth Provider

For a sample NodeJS-based oAuth provider hooked up to a local MySQL
database see: `/services/example/oauth.nodejs`

  * oAuth Server URLs:
    * `/authorize?response_type=code&redirect_uri=<URL>&client_id=<CLIENT_ID>`
    * `/token` with client credentials in the request body as dictated by OAuth 2.0 spec or using HTTP basic authentication.
    * `/profile` with a [bearer token](http://tools.ietf.org/html/rfc6750)

### Contacts API

For a sample NodeJS-based contacts API that integrates with the
sample NodeJS-base oAuth provider and is connected to the
local MySQL database see: `services/example/contacts.nodejs`


Test against Sandbox
--------------------

Go to the sandbox at [http://fly.hookflash.me/providers](fly.hookflash.me/providers) and follow instructions.

