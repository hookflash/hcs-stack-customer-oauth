Hookflash Services Example Stack - Customer oAuth
=================================================

The oAuth approach is the simplest way to integrate with Hookflash.

You need:

  * An **oAuth Server** that you hookup to your user database
  * A **Contacts API** that you hookup to your user database

Follow the steps below to integrate with Hookflash by running your own
**oAuth Server** and **Contacts API**.


1. Setup services
-----------------

Setup the following services on your own infrastructure. You can use the sample code
in this repository or a different implementation.

**WARNING: Do NOT connect your live database! You MUST BE USING TEST DATA!**

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

  * Contacts Server URLs:
    * `:82/contacts?access_token=<OAUTH_ACCESS_TOKEN>`

Hookflash can write an adapter for whichever contacts API you prefer to use.

**NOTE:** The example shows a
[very simple API](https://github.com/hookflashco/hcs-stack-customer-oauth/blob/268bad163195bd9e1c3f459cf1bc609d1447311e/services/example/contacts.nodejs/server.js#L92-L105)
which always returns all contacts. This obviously does not scale if there are many contacts
and some form of paging must be supported.


2. Request Sandbox
------------------

Email support@hookflash.com to request an **Integration Sandbox**.

To complete the integration we need the following information from you:

  * Your **oAuth Server** `authorize`, `token` and `profile` URIs as detailed above.
  * The `clientId` and `secret` for a *Hookflash Identity* app configured on your **oAuth Server**.
  * Your **Contacts API** specification so we may write an adapter.

Integration typically takes a few weeks and is an interactive process we like to conduct via Github.

If you have any questions or problems with the integration you can get support by:

  1. Filing generic issues at https://github.com/hookflashco/hcs-stack-customer-oauth/issues
  2. Sending sensitive questions to support@hookflash.com

You will get a URL to your own **Integration Sandbox** that you can use to test
your integration.



Development
===========

**Status: Experimental**

You may launch a Digital Ocean instance using our development scripts. This is an
*optional* convenience provided by Hookflash to improve the integration process. These
development scripts will change in future and are NOT intended for production use at this time! 

Requirements:

  * NodeJS `0.10+`
  * OSX or Ubuntu

Install:

    git clone git@github.com:hookflashco/hcs-stack-customer-oauth.git hcs-stack-customer-oauth
    cd hcs-stack-customer-oauth

    bin/install.sh

Deploy:

    source bin/activate.sh
    pio deploy

Updating:

    source bin/activate.sh
    pio clean
    git pull origin master
    bin/install.sh
    pio deploy

