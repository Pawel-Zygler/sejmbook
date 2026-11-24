import mpsData from '../data/mps.json';
import clubsData from '../data/clubs.json';
import flightsData from '../data/flights.json';
import airportsData from '../data/airports.json';
import newsData from '../data/news.json';
import attendanceData from '../data/attendance.json';
import careerData from '../data/career.json';
import lifeData from '../data/life.json';
import wikiPartiesData from '../data/wiki-parties.json';
import termsData from '../data/terms.json';
import earlyTermsData from '../data/early-terms.json';
import contactsData from '../data/contacts.json';
import { createApp } from './app.js';

createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, mediaData: window.__SEJM_MEDIA__ });
