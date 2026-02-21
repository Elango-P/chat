# My Portfolio Mobile App

A standalone Expo application for real-time chat with push notifications, designed to work with your portfolio website.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the app**:
   - `npx expo start` (Scan QR code with Expo Go)
   - `npm run ios`
   - `npm run android`

## Backend Integration
This app connects to your Supabase project and uses the Next.js API route for sending messages to trigger hybrid push notifications (Web + Mobile).

## Features
- Real-time message sync
- Push Notification registration
- Premium dark mode UI
- Optimistic updates
