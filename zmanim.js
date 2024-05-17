const axios = require('axios');
const cron = require('node-cron');
const { DateTime } = require('luxon');

// Function to get today's date in the format 'YYYY-MM-DD'
function getTodayDate() {
    return DateTime.now().toFormat('yyyy-MM-dd');
}

// Function to query the Hebcal API and return the JSON response
async function getZmanim() {
    const todayDate = getTodayDate();
    const hebcalUrl = `https://www.hebcal.com/zmanim?cfg=json&geonameid=5277142&date=${todayDate}`;

    try {
        const response = await axios.get(hebcalUrl);
        return response.data;
    } catch (error) {
        console.error('Error fetching Zmanim:', error);
        return null;
    }
}

// Function to trigger the IFTTT webhook with Zmanim payload
async function triggerIFTTT(zmanim, type) {
    const iftttUrl = 'https://maker.ifttt.com/trigger/send_zmanim/json/with/key/oEnufm6zNCsxwyRFNYgzkTH1IUGt_Ck2ZV3Sp-bxFrw';

    try {
        await axios.post(iftttUrl, {
            value1: JSON.stringify(zmanim),
            type: type
        });
        console.log(`IFTTT webhook triggered with type: ${type}`);
    } catch (error) {
        console.error('Error triggering IFTTT webhook:', error);
    }
}

// Function to schedule a cron job to trigger the IFTTT webhook at a specific time
function scheduleCronTrigger(triggerTime, zmanim, type) {
    const cronTime = triggerTime.toFormat('m H d M *');
    cron.schedule(cronTime, async () => {
        await triggerIFTTT(zmanim, type);
        console.log(`Cron job executed for type: ${type} at ${triggerTime.toFormat('h:mm a')}`);
    }, {
        timezone: 'America/Chicago'
    });
    console.log(`Scheduled cron job for type: ${type} at ${triggerTime.toFormat('h:mm a')}`);
}

// Define the offset times in minutes
const offsets = {
    sunrise: 30,
    sofZmanShma: 30,
    sofZmanTfilla: 30,
    minchaGedola: 25,
    minchaKetana: 30,
    sunset: 30,
    tzeit85deg: 30
};

// Function to schedule the triggers based on Zmanim times
async function scheduleTriggers() {
    console.log('Fetching Zmanim...');
    const zmanim = await getZmanim();
    if (zmanim && zmanim.times) {
        const times = zmanim.times;

        // Schedule triggers for 1 hour before sunrise
        const summaryTime = DateTime.fromISO(times.sunrise).setZone('America/Chicago').minus({ minutes: 60 });
        scheduleCronTrigger(summaryTime, zmanim, 'summary');

        // Schedule triggers based on offset times
        const triggerTimes = [
            { time: times.sunrise, type: 'sunrise', offset: offsets.sunrise },
            { time: times.sofZmanShma, type: 'sofZmanShma', offset: offsets.sofZmanShma },
            { time: times.sofZmanTfilla, type: 'sofZmanTfilla', offset: offsets.sofZmanTfilla },
            { time: times.minchaGedola, type: 'minchaGedola', offset: offsets.minchaGedola },
            { time: times.minchaKetana, type: 'minchaKetana', offset: offsets.minchaKetana },
            { time: times.sunset, type: 'sunset', offset: offsets.sunset },
            { time: times.tzeit85deg, type: 'tzeit85deg', offset: offsets.tzeit85deg }
        ];

        triggerTimes.forEach(({ time, offset, type }) => {
            if (time) {
                const triggerTime = DateTime.fromISO(time).setZone('America/Chicago').minus({ minutes: offset });
                scheduleCronTrigger(triggerTime, zmanim, type);
            } else {
                console.log(`Invalid time for type: ${type}`);
            }
        });
    }
}

// Schedule the daily task at 2 AM CT (which is 7 AM UTC)
cron.schedule('0 7 * * *', async () => {
    await scheduleTriggers();
}, {
    scheduled: true,
    timezone: 'America/Chicago'
});

// Fetch Zmanim and trigger the IFTTT webhook on startup to verify it's working
(async () => {
    const zmanim = await getZmanim();
    if (zmanim && zmanim.times) {
        const times = zmanim.times;

        // Output scheduled times to the console
        console.log('Scheduled times for today:');
        const summaryTime = DateTime.fromISO(times.sunrise).setZone('America/Chicago').minus({ minutes: 60 });
        console.log(`1 hour before sunrise: ${summaryTime.toFormat('h:mm a')}`);

        const triggerTimes = [
            { time: times.sunrise, label: 'sunrise', offset: offsets.sunrise },
            { time: times.sofZmanShma, label: 'sofZmanShma', offset: offsets.sofZmanShma },
            { time: times.sofZmanTfilla, label: 'sofZmanTfilla', offset: offsets.sofZmanTfilla },
            { time: times.minchaGedola, label: 'minchaGedola', offset: offsets.minchaGedola },
            { time: times.minchaKetana, label: 'minchaKetana', offset: offsets.minchaKetana },
            { time: times.sunset, label: 'sunset', offset: offsets.sunset },
            { time: times.tzeit85deg, label: 'tzeit85deg', offset: offsets.tzeit85deg }
        ];

        triggerTimes.forEach(({ time, offset, label }) => {
            if (time) {
                const triggerTime = DateTime.fromISO(time).setZone('America/Chicago').minus({ minutes: offset });
                console.log(`${offset} minutes before ${label}: ${triggerTime.toFormat('h:mm a')}`);
            } else {
                console.log(`Invalid time for ${label}`);
            }
        });

        // Trigger the IFTTT webhook on startup
        await triggerIFTTT(zmanim, 'startup');
    }
})();
