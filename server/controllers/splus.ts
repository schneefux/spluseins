import * as express from 'express';
import * as TIMETABLES from '../assets/timetables.json';

import { TimetableRequest, TimetableMetadata, Timetable } from '../model/SplusEinsModel';
import { getEvents, getUniqueEvents } from '../lib/SplusApi';

const CACHE_SECONDS = parseInt(process.env.SPLUS_CACHE_SECONDS || '10800');

const router = express.Router();
const flatten = <T>(arr: T[][]) => [].concat(...arr) as T[];

/**
 * Accept CORS preflight requests.
 */
router.options('/:timetable/lectures');
router.options('/:timetable/:weeks');
router.options('/:timetables/:weeks/:lectures?/:name');

/**
 * Get unique lectures for given timetable id
 *
 * @param timetable id
 * @return Array of unique events
 */
router.get('/:timetable/lectures', async (req, res, next) => {
  const timetableId = req.params.timetable;
  const timetable = TIMETABLES.find(({ id }) => id == timetableId);

  if (!timetable) {
    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.sendStatus(404);
    return;
  }

  try {
    // Don't set week in request since it's not used anyway
    const request: TimetableRequest = <TimetableRequest>{
      id: timetable.id,
      skedPath: timetable.skedPath,
      faculty: timetable.faculty,
      type: timetable.type
    };
    const events = await getUniqueEvents(request);

    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Timetable for given id and week
 *
 * @param timetable id
 * @param weeks Comma-separated list of weeks
 * @return Timetable
 */
router.get('/:timetable/:weeks', async (req, res, next) => {
  const timetableId = req.params.timetable;
  const timetable = TIMETABLES.find(({ id }) => id == timetableId);

  const weeks = req.params.weeks
    .split(',')
    .filter((week) => week.length > 0)
    .map((week) => parseInt(week));

  if (!timetable || weeks.length == 0) {
    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.sendStatus(404);
    return;
  }

  try {
    const requests = weeks.map((week) => (<TimetableRequest> {
      id: timetable.id,
      week: week,
      skedPath: timetable.skedPath,
      faculty: timetable.faculty,
      type: timetable.type
    }));
    const events = await getEvents(requests);

    const meta: TimetableMetadata = <TimetableMetadata> {
      id: timetable.id,
      faculty: timetable.faculty,
      degree: timetable.degree,
      specialisation: timetable.label,
      semester: Number(timetable.semester)
    };
    const response: Timetable = <Timetable> {
      name: timetable.degree == 'Räume'
        ? `${timetable.semester} ${timetable.label}`
        : `${(timetable.degree)} ${timetable.label} - ${timetable.semester}. Semester`,
      events: events,
      meta: meta
    };

    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Timetable with given name for given timetable Ids, week and event Ids
 *
 * @param timetables Comma-separated list of timetable IDs
 * @param weeks Comma-separated list of weeks.
 * @param lectures Comma-separated list of lecture title IDs
 * @param name Name of requested Timetable
 * @return Timetable
 */
router.get('/:timetables/:weeks/:lectures?/:name', async (req, res, next) => {
  const timetableIds = <string[]>req.params.timetables.split(',');
  const titleIds = <string[]>(req.params.lectures || '')
    .split(',')
    .filter((titleId) => titleId.length > 0);

  const timetables = timetableIds
    .map((timetableId) => TIMETABLES.find(({ id }) => id == timetableId))
    .filter((timetable) => timetable != undefined);

  const weeks = req.params.weeks
    .split(',')
    .filter((week) => week.length > 0)
    .map((week) => parseInt(week));

  if (timetables.length == 0 || weeks.length == 0) {
    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.sendStatus(404);
    return;
  }

  const name = req.params.name;

  try {
    const requests = <TimetableRequest[]>flatten(timetables.map((timetable) => weeks.map((week) => (<TimetableRequest> {
      id: timetable.id,
      week: week,
      skedPath: timetable.skedPath,
      faculty: timetable.faculty,
      type: timetable.type
    }))));
    const allEvents = await getEvents(requests);
    const filteredEvents = titleIds.length > 0
      ? allEvents.filter(({ id }) => titleIds.includes(id))
      : allEvents;

    const meta: TimetableMetadata = <TimetableMetadata> {
      id: timetableIds,
      faculty: timetables.map((x) => x.faculty),
      degree: timetables.map((x) => x.degree),
      specialisation: timetables.map((x) => x.label),
      semester: timetables.map((x) => Number(x.semester))
    };

    const timetable: Timetable = <Timetable> {
      name: name,
      events: filteredEvents,
      meta: meta
    };

    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.json(timetable);
  } catch (error) {
    next(error);
  }
});

export default router;
