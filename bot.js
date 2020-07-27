const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const ytdl = require("ytdl-core-discord");
const prism = require("prism-media");
const yts = require("yt-search");

let connection = undefined;
let dispatcher = undefined;
let volume = 10;
let currentlyPlayingSong = false;

class Queue {
    items = [];

    constructor() {}

    enqueue(element) {
        this.items.push(element);
    }

    dequeue() {
        if (this.isEmpty()) return "Underflow";
        return this.items.shift();
    }

    isEmpty() {
        return this.items.length == 0;
    }

    printQueue() {
        var str = "";
        for (var i = 0; i < this.items.length; i++) str += this.items[i] + " ";
        return str;
    }
}

let songQueue = new Queue();

client.on("ready", () => {
    console.log("I am ready!");
});

client.on("message", async (message) => {
    // Exit and stop if it's not there
    if (!message.content.startsWith(config.prefix) || message.author.bot) {
        return;
    }

    const args = message.content
        .slice(config.prefix.length)
        .trim()
        .split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === "ping") {
        message.channel.send("pong!");
    }

    if (command === "foo") {
        message.channel.send("bar!");
    }

    if (command === "say") {
        let text = args.join(" ");
        message.delete();
        message.channel.send({
            embed: {
                color: 3447003,
                description: text,
            },
        });
    }
    if (command === "play") {
        if (args.length == 0) {
            return message.channel.send("You need to say what song to play.");
        }

        if (songQueue.isEmpty() && currentlyPlayingSong == false) {
            if (!message.member.voice.channel) {
                return message.channel.send(
                    "You need to connect to a voice channel."
                );
            }

            let validate = await ytdl.validateURL(args[0]);

            let url = "";

            if (validate) {
                console.log("Valid URL given.");
                playSong(args[0]);
            } else {
                yts(args.join(" "), async (err, response) => {
                    if (err) throw err;

                    //console.log(response.videos[0]);
                    url = response.videos[0].url;
                    validate = await ytdl.validateURL(url);

                    if (!validate) {
                        return message.channel.send(
                            "Something has gone wrong with the yt video search url."
                        );
                    }

                    playSong(
                        url,
                        message.member.voice.channel,
                        message.channel
                    );
                });
            }
        } else {
            songQueue.enqueue(args.join(" "));
            return message.channel.send(
                `Added "${args.join(" ")}" to the queue`
            );
        }
    }
    if (command === "volume") {
        if (args.length == 0) {
            return message.channel.send(`The volume is set at ${volume}`);
        }
        let newVolume = parseInt(args[0]);

        if (isNaN(volume)) {
            return message.channel.send("Volume has to be a number.");
        }

        if (dispatcher == undefined) {
            volume = newVolume;
            return message.channel.send(
                `Volume set to ${newVolume} (default volume is 10)`
            );
        }
        volume = newVolume;
        dispatcher.setVolumeLogarithmic(volume / 10);
        message.channel.send(
            `Volume set to ${newVolume} (default volume is 10)`
        );
    }
    if (command === "stop" || command === "leave") {
        connection.channel.leave();
        connection = undefined;
    }
    if (command === "queue") {
        let messageToSend = [];
        messageToSend.push(`Next songs to be played:`);
        for (let i = 0; i < songQueue.items.length; i++) {
            messageToSend.push(`"${songQueue.items[i]}"`);
        }
        return message.channel.send(messageToSend.join("\n"));
    }
    if (command === "help") {
        return message.channel.send(
            `The current prefix is "${config.prefix}"
			
			Commands:
			---- ping
			pong!
			---- say
			say stuff
			---- play
			play songs either from youtube search or from youtube URL. If a song is already playing, it will be added to the queue
			---- stop / leave
			bot will stop and leave
			---- queue
			show the queue of songs to be played next
			---- help
			what you're looking at right now
			`
        );
    }
});

async function playSong(url, voiceChannel, textChannel) {
    let info = await ytdl.getInfo(url);

    connection = await voiceChannel.join();

    let input = await ytdl(url);

    let pcm = input.pipe(
        new prism.opus.Decoder({
            rate: 48000,
            channels: 2,
            frameSize: 960,
            volume: volume / 10,
        })
    );

    dispatcher = connection.play(pcm, { type: "converted" });
    textChannel.send(
        `Now Playing: ${info.title} (${Math.floor(info.length_seconds / 60)}:${
            info.length_seconds % 60
        })`
    );
    currentlyPlayingSong = true;

    dispatcher.on("finish", async () => {
        if (songQueue.isEmpty()) {
            connection.channel.leave();
            connection = undefined;
            currentlyPlayingSong = false;
        } else {
            let nextSongArgs = songQueue.dequeue().split(" ");

            let validate = await ytdl.validateURL(nextSongArgs[0]);

            let url = "";

            if (validate) {
                playSong(nextSongArgs[0], voiceChannel, textChannel);
            } else {
                yts(nextSongArgs.join(" "), async (err, response) => {
                    if (err) throw err;

                    url = response.videos[0].url;
                    validate = await ytdl.validateURL(url);

                    if (!validate) {
                        return message.channel.send(
                            "Something has gone wrong with the yt video search url."
                        );
                    }

                    playSong(url, voiceChannel, textChannel);
                });
            }
        }
    });
}

client.login(config.token);
