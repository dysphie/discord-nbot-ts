# [Discord] NBot

This is my own personal bot, designed to exist in a single small guild with friends.

Powered by:

| Typescript  | discord.js  |  MongoDB |  OpenCage  |  TomorrowIO | Uberduck | OpenAI
|---|---|---|---|---|---|---|
| <img src="https://user-images.githubusercontent.com/11559683/185683112-b10a4e41-4b6f-4cf6-a561-72f297d2e029.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185682765-b9903f38-9506-44ef-aab3-6bf0fb62c37d.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185683022-287e4b02-cb9d-4fef-b6a9-140be24b6597.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185683156-32968d7f-4922-4bb3-ad16-c40af3586dc9.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185683406-dcaef443-7e8b-4e55-8f15-77e7dff4b979.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185683503-3a07acf1-1c82-48ba-a756-2c76c4ba0180.png" height="48" /> | <img src="https://user-images.githubusercontent.com/11559683/185683654-557c21cc-523b-408e-96a0-721a97d59d63.png" height="48" /> |


## Requirements
- A server to host the JavaScript code (I use [Heroku](https://heroku.com/)) 
- (Optional) A MongoDB database (I use [Atlas](https://www.mongodb.com/atlas/database)) (used by the Emoter, Weather, Mimic, Yeller, Reminder and Starboard modules)
- (Optional) An [OpenCage](https://opencagedata.com) API key (used by the Weather module)
- (Optional) A [TomorrowIO](https://www.tomorrow.io/weather-api) API key  (used by the Weather module)
- (Optional) A [Uberduck](https://app.uberduck.ai/) username and password (used by the Uberduck module)
- (Optional) An [OpenAI](https://beta.openai.com/playground) API key (used by the Autocomplete module)

## Setup
- Set `NBOT_DISCORD_TOKEN` to your bot account's token (found [here](https://discord.com/developers/applications))
- Set `NBOT_MONGODB_URI` to your MongoDB database URI 
- Set `NBOT_MONGODB_AES_KEY` to a secure random string
- Set `NBOT_OWNER_ID` to the Discord ID of the account that should have full permissions over the bot
- (Optional) Set the `NBOT_OPENCAGE_API_KEY` environment variable to your OpenCage API key
- (Optional) Set the `NBOT_TOMORROW_API_KEY` environment variable to your TomorrowIO API key
- (Optional) Set the `NBOT_UBERDUCK_KEY` environment variable to your Uberduck username and `NBOT_UBERDUCK_SECRET` to your Uberduck password

## Module management

All modules are disabled by default, you can manage them via commands
- `/module list` - Lists all available modules
- `/module enable <module name>` - Enables the given module for the current guild
- `/module disable <module name>` - Disables the given module for the current guild

## Emoter

Upload emotes via URL and use them without a Nitro subscription via `$keyword`

![image](https://user-images.githubusercontent.com/11559683/185674640-78870857-e386-4da0-97f2-8a79e3c2a273.png)
->
![Xl0Gjcr](https://user-images.githubusercontent.com/11559683/185674817-c12acaa2-a8e4-43ad-b768-e8cc2e77a739.gif)

Slash commands:
- `/emoter add <keyword> <url>` - Uploads an emote via URL and assigns it to the given keyword
- `/emoter find <keyword>` - Returns a list of emotes that lazily match the current keyword
- `/emoter random` - Picks a registered emote randomly and posts it to chat
- `/emoter test` - Tests whether a given keyword resolves to a valid emote
- `/emoter edit <keyword> <url>` - Edits an existing emote if you are the original uploader
- `/emoter remove <keyword>` - Deletes an emote if you are the original uploader

## Mimic

Allows you to mimic other users via old messages and markov chains (requires the other user has opted in)

Slash commands:
- `/mimic <user>` - Posts 3 randomly generated sentences based on this user
- `/mimic_optout` - Deletes all stored data pertaining to your markov model (after opting in)

## PatchBot adblocker

- Reposts [PatchBot](https://patchbot.io) patch notes without the annoying advertisements

## Permathreads

- Creates threads that never expire, by constantly bumping them. Must list the thread IDs in `config.ts`

## Weather

- Posts weather information for a given location

![image](https://user-images.githubusercontent.com/11559683/185676069-6c824aa1-8079-4fb9-b89f-20bbc8f9dba9.png)

Slash commands:
- `/weather <address, city or country>` 

## Name color picker

Allows users to freely set their name color to whatever value they want

![image](https://user-images.githubusercontent.com/11559683/185676477-f8d7640a-2c0e-48d3-8d35-014333980920.png)

Slash commands
- `/namecolor <hex string | auto | none>`

## InspiroBot

- Wraps https://inspirobot.me to post a -somewhat- inspirational quote


## Reminder

Create reminders that show up at a given time

Slash commands
- `/reminder <message> <days> <hours> <minutes>`


## Animals

Posts random cute animals!

Slash commands
- `/animal <cat|dog|lizard>`

## Yellers

Replies to ALL CAPS messages with previously sent ALL CAPS messages, it's very funny I promise.

## Uberduck

Wraps UberduckAI's [Vocalize](https://app.uberduck.ai/speak#mode=tts-basic) to narrate prompts with a given voice

![image](https://user-images.githubusercontent.com/11559683/185677545-e34ce4c8-58c8-4944-8401-011439845661.png)

Slash commands:
- `/vocalize <voice> <prompt>`

## Auto completion

Wraps [OpenAI's GPT-3 API](https://beta.openai.com/playground) to autocomplete the given prompt

![image](https://user-images.githubusercontent.com/11559683/185678377-e10fb621-3969-4637-b7cb-f9278dd1e50b.png)


Slash commands:
- `/complete <prompt>`

## Imagine

Pictures any given prompt leveraging [Craiyon (formelly DALL-E mini)](https://www.craiyon.com)

![image](https://user-images.githubusercontent.com/11559683/185678144-3efa29f0-8f78-4729-a4e2-faf8d26f02c2.png)

Slash commands
- `/imagine <prompt>`

## Starboard

Bookmarks messages in a dedicated channel by reacting to them with "⭐"

![image](https://user-images.githubusercontent.com/11559683/185678824-3314e5fe-4359-4682-975a-4e79c7b4872a.png)

Slash commands
- (admin only) `/starboard <channel>` - Sets the given channel as the dedicated starboard channel
