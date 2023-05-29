const express = require('express');
const cors = require('cors');
const multer = require('multer')
const FormData = require('form-data');
const { Readable } = require('stream');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffmetadata = require('ffmetadata');
const fs = require('fs');

const app = express();

app.use(cors());

const bufferToStream = (buffer) => {
    return Readable.from(buffer);
}

/**
 * Convert a time string of the format 'mm:ss' into seconds.
 * @param {string} timeString - A time string in the format 'mm:ss'.
 * @return {number} - The time in seconds.
 */
const parseTimeStringToSeconds = timeString => {
    const [minutes, seconds] = timeString.split(':').map(tm => parseInt(tm));
    return minutes * 60 + seconds;
}

const upload = multer();
ffmpeg.setFfmpegPath(ffmpegPath);
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Whisper Text-to-Speech API!');
});




app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    const audioFile = req.file;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    if (!audioFile) {
        res.status(400).json({ message: 'Audio file is required.' });
        return;
    }

    if (!startTime || !endTime) {
        res.status(400).json({ message: 'Start and end times are required.' });
        return;
    }

    // Parse and calculate the duration
    const startSeconds = parseTimeStringToSeconds(startTime);
    const endSeconds = parseTimeStringToSeconds(endTime);
    const timeDuration = endSeconds - startSeconds;

    try {
        const audioFile = req.file;
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const audioStream = bufferToStream(audioFile.buffer);

        const trimAudio = async (audioStream, endTime) => {
            const tempFileName = `temp-${Date.now()}.mp3`;
            const outputFileName = `output-${Date.now()}.mp3`;

            return new Promise((resolve, reject) => {
                audioStream.pipe(fs.createWriteStream(tempFileName))
                    .on('finish', () => {
                        ffmetadata.read(tempFileName, (err, metadata) => {
                            if (err) reject(err);
                            const duration = parseFloat(metadata.duration);
                            if (endTime > duration) endTime = duration;

                            ffmpeg(tempFileName)
                                .setStartTime(startSeconds)
                                .setDuration(timeDuration)
                                .output(outputFileName)
                                .on('end', () => {
                                    fs.unlink(tempFileName, (err) => {
                                        if (err) console.error('Error deleting temp file:', err);
                                    });

                                    const trimmedAudioBuffer = fs.readFileSync(outputFileName);
                                    fs.unlink(outputFileName, (err) => {
                                        if (err) console.error('Error deleting output file:', err);
                                    });

                                    resolve(trimmedAudioBuffer);
                                })
                                .on('error', reject)
                                .run();
                        });
                    })
                    .on('error', reject);
            });
        };

        const trimmedAudioBuffer = await trimAudio(audioStream, endTime);

        // Call the OpenAI Whisper API to transcribe the audio file
        const formData = new FormData();
        formData.append('file', trimmedAudioBuffer, { filename: 'audio.mp3', contentType: audioFile.mimetype });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');


        const config = {
            headers: {
                "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        };

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, config);
        const transcription = response.data.text;


        res.json({ transcription });
    } catch (error) {
        res.status(500).json({ error: 'Error transcribing audio' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});