Hookflash Services Example Stack - Customer oAuth
=================================================

To integrate with Hookflash services using the oAuth approach
you need:

  * An oAuth provider that you hookup to your user database
  * A contacts API that you hookup to your user database


Create Account
==============

Create account at http://fly.hookflash.me

Naviagte to http://fly.hookflash.me/providers and request your own **oAuth Identity Provider Sandbox**.

You will be provided with further setup instructions at fly.hookflash.me once your sandbox request is approved.


Setup services
==============

oAuth Provider
--------------

For a sample NodeJS-based oAuth provider hooked up to a local MySQL
database see: `/services/example/oauth.nodejs`


Contacts API
------------

For a sample NodeJS-based contacts API that integrates with the
sample NodeJS-base oAuth provider and is connected to the
local MySQL database see: `services/example/contact.nodejs`


Test Sandbox
============

Go the the sandbox in the customer portal http://fly.hookflash.me/providers and follow instructions.

