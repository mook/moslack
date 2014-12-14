Moslack
=======

This is a Slack protocol handler for Mozilla Thunderbird.

Status
------

Mostly broken.  Currently, can log in, and talk in channels, and receive
messages in same.  Formatting is not yet supported, and URLs will turn invisible
due to being treated as HTML tags.

Instantbird is not currently supported due to OAuth2 helper and ugly hijacking
of the add account wizard.

Slack API notes
---------------

- Looks like Slack wants to avoid channel marking except in batches (and using
  the RESTy API over the RTM one).
- RTM seems to handle only plain messages?
- RTM seems to handle URL formatting, but not channel / user mentions.
- RTM seems to always send back the last message?  Need to ignore it if we've
  already seen it.

Instantbird / Thunderbird Chat API notes
----------------------------------------

- Not yet sure how to handle buddies (esp. in context of Slack).  Would like to
  just add everybody we know of.
