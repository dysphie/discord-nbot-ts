# [Discord] NBot
This is my own personal bot, designed to exist in a single small guild with friends, and be run entirely on free services.

It's not field-tested, which means it will break if you try to break it. No support will be provided for it.


## Requirements
- A [Discord application](https://discord.com/developers/applications), of course
- A MongoDB database (you can get one for free at [Atlas](https://www.mongodb.com/atlas/database))
- An [OpenCage](https://opencagedata.com/) account with an API key
- A [tomorrow](https://www.tomorrow.io/) account with an API key
- An additional Discord server with admin permissions (used to store emotes)

## Building
- `npm install` inside your cloned repository
- `tsc` to build


## Running

- Environment variables
	- Set `NBOT_DISCORD_TOKEN` to your bot's token
	- Set `NBOT_OPENCAGE_API_KEY` to your OpenCage key
	- Set `NBOT_MONGODB_URI` to your MongoDB's URI
	- Set `NBOT_MONGODB_AES_KEY` to a random, secure string
	- Set `NBOT_TOMORROW_API_KEY` to your Tomorrow API key

- `node dist/bot` (you can use [Heroku](heroku.com)'s free tier)


## Features

- ### Weather 
	Prints the weather at the specified address, city, country, etc. 
  
	![image](https://user-images.githubusercontent.com/11559683/161583449-46b9b139-5213-4d31-b051-0de7f19d1343.png)

- ### PatchBot adblock and redirect
	Removes sponsored messages from [PatchBot](https://patchbot.io/) and allows you to redirect the messages somewhere else, supports threads.
  
- ### Emoter
  Allows you to save emotes and use them in chat via `$emote` syntax
  
  ![image](https://user-images.githubusercontent.com/11559683/161584525-61007eef-d8e5-4f65-b20c-6d50ac6849f0.png)
  ![image](https://user-images.githubusercontent.com/11559683/161584643-c956bf4c-1499-4e92-9fe9-6d32274823f0.png)
  ![image](https://user-images.githubusercontent.com/11559683/161584668-1264abc2-44b1-447f-99fa-142390f58f94.png)

- ### Yeller
  Bot learns `ALL CAPS MESSAGES` and replies to them, with them
  ```
  user1: HEY WHAT'S GOING ON IN THIS ROOM
  bot: I DON'T KNOW
  ```
  
- ### Namecolor
  Users can request name colors and be given a cosmetic role with it
  
  ![image](https://user-images.githubusercontent.com/11559683/161585507-8d0c658c-177b-404f-8e8a-d59ea44eaeb1.png)

- ### Wordle
  Play multiplayer [Wordle](https://www.nytimes.com/games/wordle/index.html) from within Discord
  
  ![image](https://user-images.githubusercontent.com/11559683/161586177-6a70a566-2d4e-4db0-a169-4f0cdce4c078.png)

- ### Starboard
  Star messages by reacting to them with a star emoji
  
  ![image](https://user-images.githubusercontent.com/11559683/161586608-def9da7e-3c57-4703-abf4-abafacbbdfc0.png)

- ### Permathreads
  Prevent specific threads from archiving after a few days of inactivity
  
- ### Markdown URLs
  Allow users to use URL markdown syntax to embed links

- ### Random content
  Sends random inspirational quotes, pictures of cats, dogs, etc
