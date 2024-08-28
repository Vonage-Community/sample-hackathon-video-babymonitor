# Vonage Video API Baby Monitor

## Requirements

- Node version 18+
- [NGrok](https://ngrok.com/)

## Setup

1. Clone the repo `git clone git@github.com:Vonage-Community/sample-hackathon-video-babymonitor.git`
2. CD into the directory `cd sample-hackathon-video-babymonitor`
3. run `npm install`
4. Login to your [Vonage Developer Dashboard](https://dashboard.nexmo.com)
5. Create a new application with video capabilities (The webhooks are not needed )
6. Download the private key and copy it into the project folder (same folder as step 2)
7. Copy `.env-example` to `.env`
8. Edit `.env` and add the application ID (from Step 5) and the full path to the private key
9. run `num run start`
10. start ngrok: `ngrok http 3000`
11. open the ngrok url in the browser

## Usage 

You will need two browsers on two different devices. One device should be in the baby's room, and the other can monitor the baby. If the baby starts to move or make noise, you will get an alert in the monitor.

## TODO 

- Temperature monitoring
- Cell Data QoS
- Cell Location services 
   
