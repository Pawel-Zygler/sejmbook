import mpsData from '../data/mps.json';
import clubsData from '../data/clubs.json';
import flightsData from '../data/flights.json';
import airportsData from '../data/airports.json';
import { createApp } from './app.js';

createApp(document, window, { mpsData, clubsData, flightsData, airportsData });
