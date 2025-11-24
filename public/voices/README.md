---
license: openrail
base_model:
- Supertone/supertonic
library_name: transformers.js
language:
- en
pipeline_tag: text-to-speech
---


### Transformers.js

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@huggingface/transformers) using:
```bash
npm i @huggingface/transformers
```

You can then generate audio as follows:
```js
import { pipeline } from '@huggingface/transformers';

const model_id = 'onnx-community/Supertonic-TTS-ONNX';
const tts = await pipeline('text-to-speech', model_id);

const input_text = 'This is really cool!';
const audio = await tts(input_text, {
    speaker_embeddings: 'https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/resolve/main/voices/F1.bin',
});
await audio.save('output.wav');
```