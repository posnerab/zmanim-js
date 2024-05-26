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
    console.log(`Fetching Zmanim from URL: ${hebcalUrl}`);

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
function writeRecentTime(label, time, isRecent) {
    const recentTime = { label: isRecent ? 'yes' : 'no', time: time.toISO() };
    fs.writeFileSync(`${label}.json`, JSON.stringify(recentTime), 'utf8');
    console.log(`Updated ${label}.json with label: ${isRecent ? 'yes' : 'no'} at ${time.toFormat('h:mm a')}`);
}

// Function to write the most recent time to the general recent time file
function writeGeneralRecentTime(label, time) {
    const recentTime = { label, time: time.toISO() };
    fs.writeFileSync('recent_time.json', JSON.stringify(recentTime), 'utf8');
    console.log(`Updated recent_time.json with label: ${label} at ${time.toFormat('h:mm a')}`);
}

// Function to write the halachic hour to a file
function writeHalachicHour(sunrise, sunset, now) {
    const halachicDayDuration = sunset.diff(sunrise).as('minutes');
    const halachicHourDuration = halachicDayDuration / 12;
    const elapsedMinutes = now.diff(sunrise).as('minutes');
    const halachicHour = Math.ceil(elapsedMinutes / halachicHourDuration);

    const halachicHourData = { halachicHour };
    fs.writeFileSync('halachic_hour.json', JSON.stringify(halachicHourData), 'utf8');
    console.log(`Updated halachic_hour.json with halachic hour: ${halachicHour}`);
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
            applyLabelsAndWriteFiles(label, triggerTime, zmanim.times);
            console.log(`Cron job executed for ${label} at ${triggerTime.toFormat('h:mm a')}`);
        }
    }, {
        timezone: 'America/Chicago'
    });

    const beforeAfter = isReminder ? 'before' : '';
    console.log(`Scheduled cron job for ${Math.abs(offset)} minutes ${beforeAfter} ${label}: ${triggerTime.toFormat('h:mm a')}`);
}

// Function to apply labels and write to JSON files based on the most recent time
function applyLabelsAndWriteFiles(mostRecentLabel, mostRecentTime, times) {
    const labels = {
        chatzotNight: ['chatzotNight'],
        misheyakir: ['misheyakir', 'sofZmanShma', 'sofZmanTfilla'],
        dawn: ['dawn', 'sofZmanShma', 'sofZmanTfilla'],
        sunrise: ['sunrise', 'sofZmanShma', 'sofZmanTfilla'],
        sofZmanShma: ['sunrise', 'sofZmanTfilla'],
        sofZmanTfilla: ['sunrise'],
        chatzot: ['chatzot'],
        minchaGedola: ['chatzot', 'minchaGedola'],
        minchaKetana: ['chatzot', 'minchaKetana'],
        plagHaMincha: ['plagHaMincha'],
        sunset: ['sunset'],
        beinHaShmashos: ['beinHaShmashos'],
        tzeit85deg: ['tzeit85deg'],
        tzeit72min: ['tzeit72min']
    };

    relevantZmanimKeys.forEach(key => {
        const time = times[key] ? DateTime.fromISO(times[key]).setZone('America/Chicago') : null;
        if (time) {
            const isRecent = labels[mostRecentLabel].includes(key);
            writeRecentTime(key, time, isRecent);
        }
    });

    writeGeneralRecentTime(mostRecentLabel, mostRecentTime);
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
    tzeit85deg: 30,
    tzeit72min: 30
};

// List of relevant zmanim keys
const relevantZmanimKeys = [
    'chatzotNight', 'misheyakir', 'dawn', 'sunrise', 'sofZmanShma', 'sofZmanTfilla',
    'chatzot', 'minchaGedola', 'minchaKetana', 'plagHaMincha', 'sunset', 'beinHaShmashos', 'tzeit85deg', 'tzeit72min'
];

// Function to find the next upcoming time
function getNextUpTime(times) {
    const now = DateTime.now().setZone('America/Chicago');
    const zmanimEntries = Object.entries(times)
        .filter(([key]) => relevantZmanimKeys.includes(key))
        .map(([label, time]) => ({ label, time: DateTime.fromISO(time).setZone('America/Chicago') }))
        .filter(entry => entry.time > now)
        .sort((a, b) => a.time - b.time);

    return zmanimEntries.length ? zmanimEntries[0] : { label: 'tzeit72min', time: DateTime.fromISO(times.tzeit72min).setZone('America/Chicago') };
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

        // Update all zmanim files with initial 'no' status
        relevantZmanimKeys.forEach(key => {
            const time = times[key] ? DateTime.fromISO(times[key]).setZone('America/Chicago') : null;
            if (time) writeRecentTime(key, time, false);
        });

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
            { time: times.tzeit85deg, label: 'tzeit85deg', offset: offsets.tzeit85deg },
            { time: times.tzeit72min, label: 'tzeit72min', offset: offsets.tzeit72min }
        ];

        // Schedule cron jobs and update the appropriate file with 'yes'
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
        applyLabelsAndWriteFiles(lastPassed ? lastPassed.label : nextUp.label, lastPassed ? lastPassed.time : nextUp.time, times);

        // Calculate and write the halachic hour
        const sunriseTime = DateTime.fromISO(times.sunrise).setZone('America/Chicago');
        const sunsetTime = DateTime.fromISO(times.sunset).setZone('America/Chicago');
        writeHalachicHour(sunriseTime, sunsetTime, now);
    }
}

// Schedule the daily task at 12:01 AM local time
cron.schedule('1 0 * * *', async () => {
    await scheduleTriggers();
}, {
    scheduled: true,
    timezone: 'America/Chicago'
});

// Fetch Zmanim and trigger the IFTTT webhook on startup to verify it’s working
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
        applyLabelsAndWriteFiles(lastPassed ? lastPassed.label : nextUp.label, lastPassed ? lastPassed.time : nextUp.time, zmanim.times);

        // Calculate and write the halachic hour
        const sunriseTime = DateTime.fromISO(zmanim.times.sunrise).setZone('America/Chicago');
        writeHalachicHour(sunriseTime, sunsetTime, now);
    }
})();
