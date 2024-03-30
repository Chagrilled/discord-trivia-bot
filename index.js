const { Client, GatewayIntentBits, EmbedBuilder, userMention } = require("discord.js");
const MySQL = require("mysql2/promise");

const client = new Client({
    intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages],
    allowedMentions: {
        parse: ['users'],
        repliedUser: true
    },
    restRequestTimeout: 30000
});
const { host, user, password, database, discordToken, channelName, setUsers } = require('./config.json');

const dbConfig = {
    connectionLimit: 100,
    port: 3306,
    host,
    user,
    password,
    database
};

const POINTS_CEILING = 5;
const themePrefix = ':musical_note: theme :musical_note:';
const gamePrefix = ':video_game: game :video_game:';

client.on("ready", () => {
    console.log("I'm a bot!\n");
});

client.on("messageCreate", async message => {
    if (message.author === client.user) return;

    if (!message.content.startsWith('~')) return;
    if (message.content === "~ping") return message.reply("pong");
    if (message.channel.parent.name !== channelName && message.channel.name !== channelName) return;

    if (message.content.startsWith('~leaderboard')) {
        const con = await MySQL.createConnection(dbConfig);
        try {
            const [players] = await con.query(`SELECT * FROM leaderboard ORDER BY score DESC`);
            con.end();
            let embed = new EmbedBuilder()
                .setColor("40C0EF")
                .setTitle(`Theme Trivia Leaderboard`);
            const names = [];
            const scores = [];

            players.forEach(p => {
                names.push(userMention(p.id));
                scores.push(p.score);
            });
            embed.addFields({ name: "Name", value: names.join('\n'), inline: true });
            embed.addFields({ name: "Score", value: scores.join('\n'), inline: true });

            message.reply({ embeds: [embed] });
        } catch (e) {
            console.log(e);
            await message.reply(e);
        }
        return;
    }

    const thread = message.channel;
    if (!thread) return;
    const startingMessage = await thread.fetchStarterMessage();
    const startingMessageID = startingMessage.id;

    if (setUsers.includes(message.author.id) && message.content.startsWith('~set')) {
        const m = message.content.toLowerCase().match(/game: (.+) theme: (.+)/);
        console.log("Answers: ", m);
        if (!m) {
            thread.send('Game then theme, idiot:\n`~set game: zelda/oot theme: market/town`');
            return message.delete();
        }
        // set answer in DB
        const con = await MySQL.createConnection(dbConfig);
        try {
            await con.query(`INSERT IGNORE INTO questions (id, game, theme) VALUES ("${startingMessageID}", "${m[1]}", "${m[2]}")`);
            thread.send(':musical_note: The answer has been set, start! `~guess text` to play');
            con.end();
        } catch (e) {
            console.log(e);
            await message.reply(e);
        }
        return message.delete();
    }

    if (message.content.startsWith('~guess')) {
        const answer = message.content.toLowerCase().replace('~answer', '');
        console.log(`${message.author.username} has guessed ${answer}`);
        message.delete();
        const con = await MySQL.createConnection(dbConfig);

        try {
            const [[{ theme, game }]] = await con.query(`SELECT * FROM questions WHERE id = '${startingMessageID}'`);
            const [rows] = await con.query(`SELECT * FROM history WHERE question_id = '${startingMessageID}' AND discord_id = "${message.author.id}"`);
            console.log(theme, game);
            let guessedTheme = false;
            let guessedGame = false;
            let guesses = 0;

            if (rows.length) {
                guessedTheme = rows[0].theme;
                guessedGame = rows[0].game;
                guesses = rows[0].guesses;
                if (guessedGame && guessedTheme) return;
            }

            let themeCorrect = false;
            let gameCorrect = false;

            if (!guessedTheme && theme.split('/').some(thm => answer.includes(thm)))
                themeCorrect = true;

            if (!guessedGame && game.split('/').some(gm => answer.includes(gm)))
                gameCorrect = true;

            const both = gameCorrect && themeCorrect;
            const points = Math.max(1, POINTS_CEILING - guesses);

            if (gameCorrect || themeCorrect) {
                thread.send(`🏆 ${userMention(message.author.id)} guessed the \
                ${gameCorrect ? gamePrefix : ''} \
                ${both ? '**AND**' : ''} \
                ${themeCorrect ? themePrefix : ''} \
                correctly and gained ${both ? `**${points * 2}**` : `**${points}**`} point${((points > 1) || both) ? 's' : ''} 🏆\
            `.replace(/\s\s+/g, ' '));
                await con.query(`INSERT INTO history (discord_id, question_id, game, theme) VALUES ('${message.author.id}', '${startingMessageID}', ${gameCorrect || guessedGame}, ${themeCorrect || guessedTheme}) ON DUPLICATE KEY UPDATE theme = VALUES(theme), game = VALUES(game)`);
                await con.query(`INSERT INTO leaderboard (id, score) VALUES ('${message.author.id}', 1) ON DUPLICATE KEY UPDATE score = score + ${both ? points * 2 : points}`);
            }
            else {
                thread.send(`${userMention(message.author.id)} has guessed wrong 🧠❌`);
                await con.query(`INSERT INTO history (discord_id, question_id, guesses) VALUES ('${message.author.id}', '${startingMessageID}', ${guesses}) ON DUPLICATE KEY UPDATE guesses = VALUES(guesses) + 1`);
            }

            con.end();
        } catch (e) {
            console.log(e);
            await message.reply(e);
        }
    }
});

client.login(discordToken);