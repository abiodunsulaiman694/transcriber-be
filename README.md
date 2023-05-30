# Transcriber BE

This NodeJS App accepts audio input, trims the input with `ffmpeg` and transcribes using OpenAI Whisper

To start the application in development mode:
 - Copy `.env.example` to `.env` and add the `OPEN_AI_API_KEY`. Obtain your API Key key from [Open AI Website](https://platform.openai.com/account/api-keys)
 - Run `npm run dev`
 
To run the application in production, run `npm start`
