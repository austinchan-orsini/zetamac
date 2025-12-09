# Zetamac Performance Tracker

Tracks mental-math performance while playing Zetamac by recording question data, timing, and problem patterns.

## Features
- Captures each arithmetic question and result
- Logs time to solve and detects carry/borrow operations
- Classifies multiplication problems by times-table pairs
- Saves history across sessions using Chrome Storage APIs
- Enables long-term performance insights and analysis

## Tech Stack
- JavaScript
- HTML
- CSS
- Chrome Extensions (Manifest v3)

## How It Works
A content script parses each problem shown in the Zetamac UI, records user input when submitted, and stores results locally. Logged data can then be reviewed or processed to track improvement over time.

## Installation
1. Clone or download this repository
2. Open `chrome://extensions/` in your browser
3. Enable Developer Mode
4. Select **Load unpacked**
5. Choose the project folder

## Status
Core logging and storage completed. Analytics and visualization in progress.
