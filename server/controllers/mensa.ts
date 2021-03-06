import * as express from 'express';
import * as cacheManager from 'cache-manager';
import * as fsStore from 'cache-manager-fs-hash';
import * as moment from 'moment';
import fetch from 'node-fetch';

import { MensaDayPlan } from '../model/SplusEinsModel';
import timeoutSignal = require('timeout-signal')

// default must be in /tmp because the rest is RO on AWS Lambda
const CACHE_PATH = process.env.CACHE_PATH || '/tmp/spluseins-cache';
const CACHE_DISABLE = !!process.env.CACHE_DISABLE;
const CACHE_SECONDS = parseInt(process.env.MENSA_CACHE_SECONDS || '1800');

const router = express.Router();
const cache = CACHE_DISABLE
  ? cacheManager.caching({ store: 'memory', max: 0 })
  : cacheManager.caching({
    store: fsStore,
    options: {
      path: CACHE_PATH,
      ttl: 60,
      subdirs: true
    }
  });

/**
 * Accept CORS preflight requests.
 */
router.options('/');

/**
 * Request OpenMensa API
 * - first fetch open days
 * - then select first 6 open days
 * - then fetch plan for selected days
 *
 * @return MensaDayPlan[]
 */
router.get('/', async (req, res, next) => {
  const key = 'mensa-' + moment().format('YYYY-MM-DD');
  const amountOfReturnedDays = 6;

  try {
    const data = await cache.wrap(key, async () => {
      console.log(`mensa cache miss for key ${key}`);

      const openDays = await fetch('https://openmensa.org/api/v2/canteens/166/days', { signal: timeoutSignal(3000) })
        .then((res) => res.json());

      const weekdays = openDays
        .slice(0, amountOfReturnedDays)
        .map(({ date }) => moment(date));

      const result: MensaDayPlan[] = [];

      await Promise.all(weekdays.map(async (day) => {
        const data = await fetch(`https://openmensa.org/api/v2/canteens/166/days/${day.format('YYYY-MM-DD')}/meals`, { signal: timeoutSignal(3000) })
          .then((res) => res.json());
        result.push(<MensaDayPlan>{ date: day.toDate(), data });
      }));

      return result.sort((a, b) => moment(a.date).isBefore(moment(b.date)) ? -1 : 1);
    }, { ttl: CACHE_SECONDS });

    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
