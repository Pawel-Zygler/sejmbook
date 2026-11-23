import mpsData from '../data/mps.json';
import clubsData from '../data/clubs.json';
import flightsData from '../data/flights.json';
import airportsData from '../data/airports.json';
import newsData from '../data/news.json';
import attendanceData from '../data/attendance.json';
import { createApp } from './app.js';

createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, mediaData: window.__SEJM_MEDIA__ });
