# discord-trivia-bot

Discord bot for posting piano videos of game themes and having your friends guess it. Requires an SQL DB.

To setup:
- Create a channel called `theme-trivia` (changeable in config)
- Import `table.sql` to your MySQL DB
- Set SQL credentials/host in the config
- Add users who will post clips to the `setUsers` config

To use:
- As a user in the `setUser` array, post a video to `#theme-trivia`
- Create a thread from it
- In the thread, post `~set game: the game theme: the theme
  - Sections can be split by `/` for alternate answers: `main theme/title theme/overworld and are all valid
- Everyone else messages the thread with `~guess their guesses
- There are two points for each guess - the game, and the theme.
- Guesses have to contain an entire "section" of the keywords - i.e you must include `main theme` from the example above to get the theme point
- `~leaderboard` in the channel to display that
- There are two points on offer for each guess. They don't have to be in the same guess