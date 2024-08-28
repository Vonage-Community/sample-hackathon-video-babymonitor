import Express from 'express';
import dotenv from 'dotenv';
import debug from 'debug';
import { Video } from '@vonage/video';
import path from 'path';

const log = debug('hackathon');
dotenv.config();

const rootDir = path.dirname(path.dirname(import.meta.url)).replace(
  'file://',
  '',
);

log(`Private Key File: ${process.env.VONAGE_PRIVATE_KEY}`);
log(`Application ID: ${process.env.VONAGE_APPLICATION_ID}`);

let stats = {
  connection: null,
  networkLocation: null, // TODO get location from network api
  browserLocation: null,
  temperature: null,
  talkToBaby: false,
};

const vonageVideo = new Video({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY,
});

const app = new Express();
const port = process.env.PORT || process.env.VCR_PORT || 3000;

// Catch promises
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

let session = null

app.use(Express.static(rootDir + '/public'));
app.use(Express.json());

app.get('/', async (req, res) => {
  log('Hello World');
  res.status(200).json({ok: true});
});

app.get('/start-session', catchAsync(async (req, res) => {
  log('Session', req.body);
  if (session === null ) {
    session = await vonageVideo.createSession();
  }

  const response = {
      applicationId: process.env.VONAGE_APPLICATION_ID,
      sessionId: session.sessionId,
      token: vonageVideo.generateClientToken(session.sessionId),
  }
  log('Session', response);
  res.status(200).json(response);
}));


const getBabyStatus = async (parameters) => {
  // TODO lookup temperature with sensor
  log('Getting baby status', stats);
  return stats
}

const setBabyStatus = async (parameters) => {
  log('Setting baby status', parameters);
  stats = {
    ...stats,
    ...parameters
  }

  log('new baby status', stats);
  return stats
};

const talkToBaby = async () => {
  stats.talkToBaby = true;
  return stats
}

app.put('/baby', catchAsync(async (req, res) => {
  log(`RPC call`, req.body);
  const { method, parameters, id } = req.body;

  let response = null;
  switch (method) {
    case 'getBabyStatus':
      response = await getBabyStatus(parameters);
      break;

    case 'setBabyStatus':
      response = await setBabyStatus(parameters);
      break;

    case 'talkToBaby':
      response = await talkToBaby(parameters);
      break;
  }

  res.send({
    jsonrpc: '2.0',
    result: response,
    ...(id ? { id: id } : {}),
  });
}));

// Webhook handlers
app.post('/session', catchAsync(async (req, res) => {
  log('Session', req.body);
  res.status(200).json({ok: true});
}));

app.post('/recording', catchAsync(async (req, res) => {
  log('Recording', req.body);
  res.status(200).json({ok: true});
}));

app.post('/status', catchAsync(async (req, res) => {
  log('Status', req.body);
  res.status(200).json({ok: true});
}));

app.post('/composer', catchAsync(async (req, res) => {
  log('Composer', req.body);
  res.status(200).json({ok: true});
}));

app.post('/callback', catchAsync(async (req, res) => {
  log('Callback', req.body);
  res.status(200).json({ok: true});
}));

// Setup a 404 handler
app.all('*', (req, res) => {
  log(`404: ${req.method} ${req.url}`);
  res.status(404).json({
    status: 404,
    title: 'Not Found',
  });
});

// Setup an error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    status: 500,
    title: 'Internal Server Error',
    detail: err.message,
  });
});

// Start Express
app.listen(port, () => {
  log(`app listening on port ${port}`);
});

