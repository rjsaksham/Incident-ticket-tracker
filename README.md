# Incident Ticket Tracker

A small service desk style tool that runs in the browser. It shows how an incident is logged, followed, escalated and closed.
Tickets are saved in the browser (localStorage), there is no server.

## Features
- Create incidents with category, severity (P1 to P4), affected service and description
- Auto ticket IDs (INC-0001, INC-0002, ...)
- Status flow: Open, Acknowledged, Investigating, Escalated, Resolved
- Timestamped timeline for every ticket, with notes
- Escalate to L2 team, vendor or leadership
- Bridge call log for P1 and P2 tickets
- Sample SLA timers (response and resolution) that show when a target is missed
- One click stakeholder update text that can be pasted in email or chat
- Search and filters by status and severity

## Tech
HTML, CSS, JavaScript (no libraries)

## Run
Open `index.html` in a browser. Use "Load sample tickets" to see it filled. To host free, enable GitHub Pages in the repository settings.
