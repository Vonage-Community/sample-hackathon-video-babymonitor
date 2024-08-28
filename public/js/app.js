const pixelDiffThreshold = 32;
const scoreThreshold = 160;
const motionDelay = 1000;
const noiseDelay = 500;

const noiseMinThreshold = 80;
const noiseMaxThreshold = 20;

const soundFile = `${window.location.origin}/alert.mp3`
const alertSound = new Audio(soundFile);

let publisher;
let alertTimer;

//create canvas to display processed motion image
const motionCanvas = document.getElementById('motion');
const motionContext = motionCanvas.getContext('2d');

motionCanvas.width = 320;
motionCanvas.height = 240;

const motionElement = document.getElementById('motion-value');
const monitorElement = document.getElementById('monitor');
const startUpElement = document.getElementById('startup');
const babyElement = document.getElementById('baby')

const babyCamElement = document.getElementById('baby-cam');
const parentCamElement = document.getElementById('parent-cam');

const babyQosElement = document.getElementById('baby-qos');
const monoitorQosElement = document.getElementById('monitor-qos');

const toastElement = document.getElementById('toast');
const toaster = new bootstrap.Toast(toastElement);

const handleError = (error) => {
  if (error) {
    console.error(error);
  }
}

const notify = (message) => {
  console.log('Notifying', message);
  toastElement.querySelector('.toast-body').innerText = message;
  toaster.show();
//  alertSound.play();
}

const addQueryParam = (key, value) => {
  const url = new URL(window.location);
  url.searchParams.set(key, value);
  window.history.pushState({}, '', url);
}

const initializeSession = ({applicationId, sessionId, token}) => {
  const session = OT.initSession(applicationId, sessionId);

  // Subscribe to a newly created stream
  session.on('streamCreated', (event) => {
    console.log('A stream was created', event);

    const subscriber = session.subscribe(
      event.stream,
      getMode() === 'monitor' ? 'baby-cam' : 'parent-cam',
      {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        name: getMode(),
      },
      handleError,
    );

    startCapture();
    let movingAvg = null;

    if (getMode() === 'baby') {
      return;
    }

    let alertTimer;
    let lastNoiseLevel = 0;
    let tooLoud = false;
    subscriber.on('audioLevelUpdated', function(event) {
      if (movingAvg === null || movingAvg <= event.audioLevel) {
        movingAvg = event.audioLevel;
      } else {
        movingAvg = 0.7 * movingAvg + 0.3 * event.audioLevel;
      }

      // 1.5 scaling to map the -30 - 0 dBm range to [0,1]
      var logLevel = (Math.log(movingAvg) / Math.LN10) / 1.5 + 1;
      logLevel = Math.min(Math.max(logLevel, 0), 1);
      const ordLevel = parseInt(logLevel * 100);
      document.getElementById('noise-level').value = logLevel;

      if (ordLevel > noiseMinThreshold) {
        tooLoud = true;
      }

      if (alertTimer && ordLevel < noiseMaxThreshold) {
        clearTimeout(alertTimer);
        alertTimer = null;
      }

      if (!tooLoud && alertTimer) {
        return;
      }

      alertTimer = setTimeout(() => {
        notify('Noise detected');
      }, noiseDelay);
    });
  });

  session.on('sessionDisconnected', (event) => {
    console.log('You were disconnected from the session.', event.reason);
  });

  // initialize the publisher
  publisher = OT.initPublisher(
    'publisher',
    {
      insertMode: 'append',
      width: '100%',
      height: '100%',
      name: getMode(),
    },
    handleError,
  );

  togglePublisher(false);

  // Connect to the session
  session.connect(token, (error) => {
    if (error) {
      handleError(error);
    } else {
      // If the connection is successful, publish the publisher to the session
      session.publish(publisher, handleError);
    }
  });
}

const processDiff = (diffImageData) => {
  var rgba = diffImageData.data;

  // pixel adjustments are done by reference directly on diffImageData
  var score = 0;
  for (var i = 0; i < rgba.length; i += 4) {
    var pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
    var normalized = Math.min(255, pixelDiff * (255 / pixelDiffThreshold));
    rgba[i] = 0;
    rgba[i + 1] = normalized;
    rgba[i + 2] = 0;

    if (pixelDiff >= pixelDiffThreshold) {
      score++;
    }
  }

  return {
    score: score,
    hasMotion: score >= scoreThreshold,
  };
}

const startCapture = () => {
  if (getMode() === 'baby') {
    console.log('Not starting capture in baby mode');
    return;
  }

  console.log('Starting capture');
  let video = document.getElementById('baby-cam').querySelector('video');
  let isReadyToDiff = false;

  captureCanvas = document.createElement('canvas');
  diffCanvas = document.createElement('canvas');

  captureCanvas.width = motionCanvas.width;
  captureCanvas.height = motionCanvas.height;
  captureContext = captureCanvas.getContext('2d');

  // prep diff canvas
  diffCanvas.width = motionCanvas.width;
  diffCanvas.height = motionCanvas.height;
  diffContext = diffCanvas.getContext('2d');
  let motionTimer;

  setInterval(() => {
    // give the element some time to load
    video = video || document.getElementById('baby-cam').querySelector('video');
    if (!video) {
      console.log('No video element found');
      return;
    }

    captureContext.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    diffContext.globalCompositeOperation = 'difference';
    diffContext.drawImage(video, 0, 0, diffCanvas.width, diffCanvas.height);
    const diffImageData = diffContext.getImageData(0, 0, diffCanvas.width, diffCanvas.height);

    let hasMotion = false;
    let motionScore = 0;

    if (isReadyToDiff) {
      const diff = processDiff(diffImageData);
      motionContext.putImageData(diffImageData, 0, 0);
      hasMotion = diff.hasMotion;
      motionScore = diff.score;
    }


    motionElement.innerText = hasMotion
      ? `Motion detected! Score: ${motionScore}`
      : 'No motion detected';

    // draw current capture normally over diff, ready for next time
    diffContext.globalCompositeOperation = 'source-over';
    diffContext.drawImage(video, 0, 0, diffCanvas.width, diffCanvas.height);
    isReadyToDiff = true;

    if (!hasMotion && alertTimer) {
      clearTimeout(alertTimer);
      alertTimer = null;
      return;
    }

    if (!alertTimer) {
      alertTimer = setTimeout(() => {
        notify('Motion detected');
      }, motionDelay);
    }

  }, 1000);
}

const getBabyElement = () => document.getElementById('baby');
const getParentElement = () => document.getElementById('parent');

const startMonitor = async () => {
  console.log('Starting monitor');
  addQueryParam('mode', 'monitor');

  monitorElement.classList.remove('d-none');
  startUpElement.classList.add('d-none');
  const stats = await collectLocalStats();
  const babyStats = await getStats();

  console.log('Stats', babyStats);
  document.getElementById('monitor-connection-type').innerText = stats.connection || 'Unknown';
  document.getElementById('baby-connection-type').innerText = babyStats.connection || 'Unknown';

  if (babyStats.talkToBaby) {
    document.getElementById('talk-to-baby').disabled = true;
    document.getElementById('dont-talk-to-baby').disabled = false;
  }
}

const getGeoLocation = () => new Promise((resolve, reject) => {
  console.log('Getting location');
  navigator.geolocation.getCurrentPosition((position) => {
    // TODO lookup address
    resolve(position);
  }, (error) => {
    reject(error);
  });
})

const collectLocalStats = async () => {
  console.log('Collecting local stats');
  // collect connection type
  const connection = window.navigator.connection

  const location = await getGeoLocation().catch(() => {
    console.error('Failed to get location');
    return undefined;
  });

  return {
    connection: connection,
    networkLocation: undefined, // TODO get location from network api
    browserLocation: location
  }
}

const getStats = async () => {
  console.log('Getting stats');
  const response = await fetch('/baby', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'getBabyStatus',
    }),
  });

  const data = await response.json();
  console.log('Response Data', data);
  return data.result;
}

const postStats = async (stats) => {
  console.log('Posting stats', stats);
  fetch('/baby', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'setBabyStatus',
      parameters:{
        ...stats,
      }
    }),
  });
};

const startBaby = async () => {
  console.log('Starting baby');
  addQueryParam('mode', 'baby');
  babyElement.classList.remove('d-none');
  startUpElement.classList.add('d-none');

  const stats = await collectLocalStats();
  await postStats(stats, 'monitor');

  setInterval(async () => {
    console.log('Checking baby stats');
    const serverStats = await getStats();
    console.log('Stats', serverStats);

    parentCamElement.classList.add('d-none');

    if (serverStats.talkToBaby) {
      console.log('Talk to baby');
      parentCamElement.classList.remove('d-none');
    }
  }, 1000);
}

const handelClickEvent = (event) => {
  const { target } = event;

  if (target.tagName === 'A') {
    console.log('Link clicked');
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (target.classList.contains('baby-button')) {
    console.log('Baby button clicked');
    startBaby();
    return;
  }

  if (target.classList.contains('monitor-button')) {
    console.log('Monitor button clicked');
    startMonitor();
    return;
  }

  if (target.classList.contains('talk-to-baby')) {
    console.log('Talk to baby');
    document.getElementById('talk-to-baby').disabled = true;
    document.getElementById('dont-talk-to-baby').disabled = false;
    postStats({talkToBaby: true});

    togglePublisher(true);
    return;
  }

  if (target.classList.contains('dont-talk-to-baby')) {
    console.log('Dont Talk to baby');
    document.getElementById('talk-to-baby').disabled = false;
    document.getElementById('dont-talk-to-baby').disabled = true;
    postStats({talkToBaby: false});
    togglePublisher(false);
    return;
  }
};

const togglePublisher = (state) => {
  if (getMode() === 'monitor') {
    publisher.publishAudio(state);
    publisher.publishVideo(state);
  }
};


const getMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  console.log('mode', mode);
  return mode;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Starting Vonage Video API session');

  const serverBase = location.origin;
  console.log('serverBase', serverBase);

  document.addEventListener('click', handelClickEvent);

  fetch(`${serverBase}/start-session`)
  .then((response) => response.json())
  .then(initializeSession).catch((error) => {
    handleError(error);
    alert('Failed to get Vonage Video sessionId and token');
  });

  switch(getMode()) {
    case 'monitor':
      startMonitor();
      break;

    case 'baby':
      startBaby();
      break;
  }
});
