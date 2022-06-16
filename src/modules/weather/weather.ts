import { CommandInteraction, MessageEmbed } from "discord.js";
import axios from "axios";
import getWeatherCodeDescription from "./weather_codes";
import { getGeodataForLocation } from "../../utils";
import { getMongoDatabase } from "../../mongodb";
import { Long } from "mongodb";
import { DatabaseModule } from "../../module_mgr";

class Weather extends DatabaseModule {
	guildId: string;

	constructor(name: string, description: string) {
		super(name, description);
		this.guildId = "";

		if (!process.env.NBOT_TOMORROW_API_KEY) {
			console.error(
				"NBOT_TOMORROW_API_KEY is not set. Weather will be unavailable."
			);
			return;
		}

		if (!process.env.NBOT_OPENCAGE_API_KEY) {
			console.error(
				"NBOT_OPENCAGE_API_KEY is not set. Weather geolocation will be unavailable."
			);
			return;
		}
	}

	setAssetGuild(guildId: string) {
		console.log(`Set weather guild to ${guildId}`);
		this.guildId = guildId;
	}

	async commandWeather(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			interaction.reply("This command is disabled");
			return;
		}

		if (!process.env.NBOT_TOMORROW_API_KEY) {
			await interaction.reply("Weather is not available at this time");
			return;
		}

		let location = interaction.options.getString("location");
		let privateLocation = false;
		if (!location) {
			const locationsCol = getMongoDatabase()?.collection("locations");
			if (locationsCol != undefined) {
				
				const userLocation = await locationsCol.findOne({ _id: Long.fromString(interaction.user.id) });

				if (userLocation && userLocation.addr != null) {
					location = userLocation.addr;
					privateLocation = userLocation.private === true;
				}
			}
		}

		if (!location) {
			await interaction.reply({
				content: "Please specify a location.",
				ephemeral: true
			});
			return;
		}

		const openCageRespData = await getGeodataForLocation(location);
		if (!openCageRespData) {
			await interaction.reply({
				content: "Could not find given location.",
				ephemeral: true
			});
			return;
		}

		const lat = openCageRespData["results"][0]["geometry"]["lat"];
		const lon = openCageRespData["results"][0]["geometry"]["lng"];
		const tz = openCageRespData["results"][0]["annotations"]["timezone"]["name"];
		const label = openCageRespData["results"][0]["formatted"];
		const sunset = openCageRespData["results"][0]["annotations"]["sun"]["set"]["apparent"];
		const sunrise = openCageRespData["results"][0]["annotations"]["sun"]["rise"]["apparent"];

		const sunsetTime = new Date(sunset * 1000);
		const sunriseTime = new Date(sunrise * 1000);

		// check if it's night
		const isNight = sunsetTime.getTime() > sunriseTime.getTime();

		// time 3 hours from now
		const endTime = new Date();
		endTime.setHours(endTime.getHours() + 6);

		// const reqWeatherCode = `weatherCode${isNight ? "Night" : "Day"}`;

		const tomorrowioResp = await axios.post(
			`https://api.tomorrow.io/v4/timelines?apikey=${process.env.NBOT_TOMORROW_API_KEY}`,
			{
				units: "metric",
				timesteps: ["30m"],
				startTime: new Date().toISOString(),
				endTime: endTime.toISOString(),
				location: `${lat}, ${lon}`,
				// timezone: tz,
				fields: [
					"temperatureApparentAvg",
					// "temperatureApparentMin",
					// "temperatureApparentMax",
					"humidityAvg",
					"windSpeedAvg",
					"weatherCode",
				],
			},
			{
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
			}
		);

		if (tomorrowioResp.status !== 200) {
			await interaction.reply("Internal error");
			return;
		}

		const tomorrowioRespData = tomorrowioResp.data;

		// get the temperature for the first timeline
		const nowTemp =
			tomorrowioRespData.data.timelines[0].intervals[0].values
				.temperatureApparentAvg;
		const nowHumidity =
			tomorrowioRespData.data.timelines[0].intervals[0].values
				.humidityAvg;
		const nowWind =
			tomorrowioRespData.data.timelines[0].intervals[0].values
				.windSpeedAvg;
		const nowCode =
			tomorrowioRespData.data.timelines[0].intervals[0].values
				.weatherCode;

		const nowCodeEmote = this.findEmote(interaction, nowCode, isNight);
		const nowCodeDesc = getWeatherCodeDescription(nowCode);

		//const minTemp = tomorrowioRespData.data.timelines[0].intervals[0].values.temperatureApparentMin;
		//const maxTemp = tomorrowioRespData.data.timelines[0].intervals[0].values.temperatureApparentMax;
		const nowField = `${nowCodeEmote?.toString()} ${this.formatTemp(
			nowTemp
		)} · ${this.formatHumidity(nowHumidity)} · ${this.formatWind(nowWind)}`;
		//const nowField2 = `🔺 ${this.formatTemp(maxTemp)} 🔻 ${this.formatTemp(minTemp)}`;
		const nowTime =
			tomorrowioRespData["data"]["timelines"][0]["intervals"][0][
				"startTime"
			];

		let forecast = "";

		const hourlyVals =
			tomorrowioRespData["data"]["timelines"][0]["intervals"];

		for (let i = 4; i < hourlyVals.length; i += 4) {
			const temp = hourlyVals[i]["values"]["temperatureApparentAvg"];
			const futureTime = hourlyVals[i]["startTime"];

			const futureSeconds = new Date(futureTime).getTime() / 1000;

			const futureCode = hourlyVals[i]["values"]["weatherCode"];
			const futureCodeDesc = getWeatherCodeDescription(futureCode);
			const futureIsNight = futureSeconds > sunsetTime.getTime() / 1000;

			const emoteStr = this.findEmote(
				interaction,
				futureCode,
				futureIsNight
			)?.toString();

			forecast += `${emoteStr} ${this.formatTemp(
				temp
			)} · ${futureCodeDesc} <t:${futureSeconds}:R>\n`;
		}

		// format nowTime to HH:MM using the timezone in the response
		const nowTimeFormatted = new Date(nowTime).toLocaleString("en-US", {
			timeZone: tz,
			hour: "numeric",
			minute: "numeric",
			hour12: false,
		});

		const embed = new MessageEmbed().setFields([
			{ name: `Forecast`, value: forecast, inline: true },
		]);

		if (nowField) {
			embed.setDescription(`${nowField}`);
		}

		const countryCode = openCageRespData["results"][0]["components"]["country_code"];

		if (!privateLocation) {
			embed.setFooter({
				iconURL: `https://flagcdn.com/32x24/${countryCode}.png`,
				text: `${label} at ${nowTimeFormatted}`,
			});
		} else {
			embed.setFooter({
				text: `Undisclosed location`,
			});
		}

		embed.setTitle(`${nowCodeDesc}`);
		await interaction.reply({ embeds: [embed] });
	}

	formatTemp(temp: string) {
		const flTemp = parseFloat(temp);
		return `**${Math.round(flTemp)}**°C · **${Math.round(
			flTemp * 1.8 + 32
		)}**°F`;
	}

	formatHumidity(humidity: string) {
		return `💧 ${Math.round(parseFloat(humidity))}% humidity`;
	}

	formatWind(wind: string) {
		return `🍃 ${Math.round(parseFloat(wind) * 3.6)} km/h`;
	}

	findEmote(
		interaction: CommandInteraction,
		weatherCode: string,
		isNight: boolean
	) {
		// Remove everything that isn't A-Za-z
		const desc = getWeatherCodeDescription(weatherCode);
		if (desc == null) {
			return null;
		}

		let emoteName = getWeatherCodeDescription(weatherCode).replace(
			/[^A-Za-z]/g,
			""
		);

		// HACK?: some emotes have a day/night variant
		if (
			emoteName == "Clear" ||
			emoteName == "MostlyClear" ||
			emoteName == "PartlyCloudy"
		) {
			emoteName += isNight ? "Night" : "Day";
		}

		const emoteGuild =
			this.guildId !== "" &&
			interaction.client.guilds.cache.get(this.guildId);
		if (!emoteGuild) {
			return null;
		}

		const emote = emoteGuild.emojis.cache.find(
			(emoji) => emoji.name === emoteName
		);

		return emote;
	}
}

const weather = new Weather('weather', 'Posts weather information');

export default weather;
