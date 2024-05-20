const axios = require('axios');
const cron = require('node-cron');
const { DateTime, Duration } = require('luxon');
const fs = require('fs');

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

// Function to trigger the IFTTT webhook with the payload
async function triggerIFTTT(payload) {
    const iftttUrl = 'https://maker.ifttt.com/trigger/send_zmanim/json/with/key/oEnufm6zNCsxwyRFNYgzkTH1IUGt_Ck2ZV3Sp-bxFrw';

    try {
        await axios.post(iftttUrl, payload);
        console.log(`IFTTT webhook triggered with payload: ${JSON.stringify(payload)}`);
    } catch (error) {
        console.error('Error triggering IFTTT webhook:', error);
    }
}

// Function to write the most recent time to a file
function writeRecentTime(label, time) {
    const recentTime = { label, time: time.toISO() };
    fs.writeFileSync('recent_time.json', JSON.stringify(recentTime), 'utf8');
    console.log(`Most recent time updated to ${label} at ${time.toFormat('h:mm a')}`);
}

// Function to schedule a cron job to trigger the IFTTT webhook at a specific time
function scheduleCronTrigger(triggerTime, zmanim, label, offset, isReminder = false) {
    const cronTime = triggerTime.toFormat('m H d M *');
    cron.schedule(cronTime, async () => {
        const now = DateTime.now().setZone('America/Chicago');
        const sunsetTime = DateTime.fromISO(zmanim.times.sunset).setZone('America/Chicago');

        if (isShabbat(now, sunsetTime)) {
            console.log(`Shabbat mode: Skipping IFTTT trigger for ${label}. Most recent time: ${label}`);
            return;
        }

        if (isReminder) {
            const zmanTime = DateTime.fromISO(zmanim.times[label]).setZone('America/Chicago');
            const payload = {
                value1: label,
                value2: zmanTime.toFormat('h:mm a'),
                value3: offset
            };
            await triggerIFTTT(payload);
            console.log(`Reminder sent for ${label} at ${triggerTime.toFormat('h:mm a')}`);
        } else {
            writeRecentTime(label, triggerTime);
            console.log(`Cron job executed for ${label} at ${triggerTime.toFormat('h:mm a')}`);
        }
    }, {
        timezone: 'America/Chicago'
    });

    const beforeAfter = isReminder ? 'before' : '';
    console.log(`Scheduled cron job for ${Math.abs(offset)} minutes ${beforeAfter} ${label}: ${triggerTime.toFormat('h:mm a')}`);
}

// Simplified Shabbat check function
function isShabbat(now, sunsetTime) {
    const sunsetFriday = sunsetTime.set({ weekday: 5 }).minus({ minutes: 18 });
    const sunsetSaturday = sunsetTime.set({ weekday: 6 }).plus({ minutes: 72 });

    if (now >= sunsetFriday && now <= sunsetSaturday) {
        console.log(`Current time ${now.toFormat('f')} is within Shabbat period from ${sunsetFriday.toFormat('f')} to ${sunsetSaturday.toFormat('f')}.`);
        return true;
    } else {
        console.log(`Current time ${now.toFormat('f')} is outside Shabbat period from ${sunsetFriday.toFormat('f')} to ${sunsetSaturday.toFormat('f')}.`);
        return false;
    }
}

// Define the offset times in minutes
const offsets = {
    chatzotNight: 30,
    misheyakir: 30,
    dawn: 30,
    sunrise: 30,
    sofZmanShma: 30,
    sofZmanTfilla: 30,
    chatzot: 30,
    minchaGedola: 30,
    minchaKetana: 30,
    plagHaMincha: 30,
    sunset: 60,
    beinHaShmashos: 30,
    tzeit85deg: 30
};

// List of relevant zmanim keys
const relevantZmanimKeys = [
    'chatzotNight', 'misheyakir', 'dawn', 'sunrise', 'sofZmanShma', 'sofZmanTfilla',
    'chatzot', 'minchaGedola', 'minchaKetana', 'plagHaMincha', 'sunset', 'beinHaShmashos', 'tzeit85deg'
];

// Function to find the next upcoming time
function getNextUpTime(times) {
    const now = DateTime.now().setZone('America/Chicago');
    const zmanimEntries = Object.entries(times)
        .filter(([key]) => relevantZmanimKeys.includes(key))
        .map(([label, time]) => ({ label, time: DateTime.fromISO(time).setZone('America/Chicago') }))
        .filter(entry => entry.time > now)
        .sort((a, b) => a.time - b.time);

    return zmanimEntries.length ? zmanimEntries[0] : { label: 'tzeit85deg', time: DateTime.fromISO(times.tzeit85deg).setZone('America/Chicago') };
}

// Function to get the last time that has passed
function getLastPassedTime(times) {
    const now = DateTime.now().setZone('America/Chicago');
    const zmanimEntries = Object.entries(times)
        .filter(([key]) => relevantZmanimKeys.includes(key))
        .map(([label, time]) => ({ label, time: DateTime.fromISO(time).setZone('America/Chicago') }))
        .filter(entry => entry.time <= now)
        .sort((a, b) => b.time - a.time);

    return zmanimEntries.length ? zmanimEntries[0] : null;
}

// Function to schedule the triggers based on Zmanim times
async function scheduleTriggers() {
    console.log('Fetching Zmanim...');
    const zmanim = await getZmanim();
    if (zmanim && zmanim.times) {
        console.log('Successfully fetched Zmanim.');
        const times = zmanim.times;

        // Schedule triggers based on offset times
        const triggerTimes = [
            { time: times.chatzotNight, label: 'chatzotNight', offset: offsets.chatzotNight },
            { time: times.misheyakir, label: 'misheyakir', offset: offsets.misheyakir },
            { time: times.dawn, label: 'dawn', offset: offsets.dawn },
            { time: times.sunrise, label: 'sunrise', offset: offsets.sunrise },
            { time: times.sofZmanShma, label: 'sofZmanShma', offset: offsets.sofZmanShma },
            { time: times.sofZmanTfilla, label: 'sofZmanTfilla', offset: offsets.sofZmanTfilla },
            { time: times.chatzot, label: 'chatzot', offset: offsets.chatzot },
            { time: times.minchaGedola, label: 'minchaGedola', offset: offsets.minchaGedola },
            { time: times.minchaKetana, label: 'minchaKetana', offset: offsets.minchaKetana },
            { time: times.plagHaMincha, label: 'plagHaMincha', offset: offsets.plagHaMincha },
            { time: times.sunset, label: 'sunset', offset: offsets.sunset },
            { time: times.beinHaShmashos, label: 'beinHaShmashos', offset: offsets.beinHaShmashos },
            { time: times.tzeit85deg, label: 'tzeit85deg', offset: offsets.tzeit85deg }
        ];

        triggerTimes.forEach(({ time, offset, label }) => {
            if (time) {
                const reminderTime = DateTime.fromISO(time).setZone('America/Chicago').minus({ minutes: offset });
                scheduleCronTrigger(reminderTime, zmanim, label, offset, true);

                const actualTime = DateTime.fromISO(time).setZone('America/Chicago');
                scheduleCronTrigger(actualTime, zmanim, label, 0, false);
            } else {
                console.log(`Invalid time for ${label}`);
            }
        });

        // Find and set the next up time or last passed time
        const nextUp = getNextUpTime(times);
        const lastPassed = getLastPassedTime(times);
        const now = DateTime.now().setZone('America/Chicago');
        const minutesAgo = lastPassed ? Math.round(Duration.fromObject({ milliseconds: now.diff(lastPassed.time).milliseconds }).as('minutes')) : 0;

        const startupPayload = {
            value1: nextUp.label,
            value2: nextUp.time.toFormat('h:mm a'),
            value3: minutesAgo
        };

        await triggerIFTTT(startupPayload);
        writeRecentTime(lastPassed ? lastPassed.label : nextUp.label, lastPassed ? lastPassed.time : nextUp.time);
    }
}

// Schedule the daily task at 12:01 AM local time
cron.schedule('1 0 * * *', async () => {
    await scheduleTriggers();
}, {
    scheduled: true,
    timezone: 'America/Chicago'
});

// Fetch Zmanim and trigger the IFTTT webhook on startup to verify it's working
(async () => {
    await scheduleTriggers();

    // Simple trigger of the webhook on startup with next up time information
    const zmanim = await getZmanim();
    if (zmanim && zmanim.times) {
        const nextUp = getNextUpTime(zmanim.times);
        const lastPassed = getLastPassedTime(zmanim.times);
        const now = DateTime.now().setZone('America/Chicago');
        const minutesAgo = lastPassed ? Math.round(Duration.fromObject({ milliseconds: now.diff(lastPassed.time).milliseconds }).as('minutes')) : 0;

        const startupPayload = {
            value1: nextUp.label,
            value2: nextUp.time.toFormat('h:mm a'),
            value3: minutesAgo
        };

        const sunsetTime = DateTime.fromISO(zmanim.times.sunset).setZone('America/Chicago');
        if (!isShabbat(now, sunsetTime)) {
            await triggerIFTTT(startupPayload);
        } else {
            console.log(`Shabbat mode: Skipping IFTTT trigger for startup. Most recent time: ${lastPassed ? lastPassed.label : nextUp.label}`);
        }
        writeRecentTime(lastPassed ? lastPassed.label : nextUp.label, lastPassed ? lastPassed.time : nextUp.time);
    }
})();
