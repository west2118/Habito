# APPLICATION REQUIREMENTS SPECIFICATION

## Project Title
**Habito** — Photo-Proof Habit Tracker & Visual Journal

---

## 1. Executive Summary & Overview

### 1.1 App Description
**Habito** is an innovative cross-platform habit tracking application built with **React Native (Expo)** and **Supabase**. Unlike standard habit tracking apps that rely on simple checkboxes, Habito introduces **photo proof verification** as the core mechanic for habit completion. 

To mark a habit as done for the day, users capture or upload a photographic proof (e.g., a photo of running shoes, a finished book page, a healthy meal, or a gym check-in). This visual approach fosters honesty, accountability, and a high level of motivation by creating a personal visual album of real progress over time.

### 1.2 Key Value Proposition
- **Honest Tracking**: Photo proof prevents mindless checkbox ticking.
- **Visual Motivation**: Transforms habits into rich visual logs and customizable photo albums.
- **Automated Gamification**: Automatically calculates current and longest streaks based on logged visual proofs.
- **Historical Memory**: Calendar-based proof viewing and habit photo albums allow users to look back on their journey.

---

## 2. Technical Stack & Architecture

- **Frontend Application**: React Native with Expo (Expo SDK 57, Expo Router, TypeScript)
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage for high-res photo proof storage & delivery)
- **State Management & Data Fetching**: React Hooks, Context / Query management
- **UI & Aesthetics**: Modern responsive design, custom frame themes, glassmorphism, dynamic color accents, micro-animations

---

## 3. Database Schema Overview (Supabase PostgreSQL)

Based on the official database design, **Habito** operates on four core relational tables:

```
[auth.users] ─── (1:1) ───> [profiles]
                                │
                                ├─── (1:N) ───> [habits] ─── (1:N) ───> [habit_logs]
                                │                  │
                                └─── (1:N) ───> [habit_albums] <───────┘
```

### 3.1 Entity Definitions & Field Mapping

#### 1. `profiles`
Stores extended user profile information synced with `auth.users`.
- `id` (`uuid`, Primary Key, references `auth.users.id`)
- `email` (`text`, unique)
- `full_name` (`text`)
- `avatar_url` (`text`)
- `timezone` (`text`)
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

#### 2. `habits`
Defines individual habits configured by users.
- `id` (`uuid`, Primary Key)
- `user_id` (`uuid`, Foreign Key -> `profiles.id`)
- `title` (`text`, e.g., "Morning Run", "Read 20 Pages")
- `icon` (`text`, emoji or icon key)
- `color` (`text`, hex or color token)
- `type` (`text`, e.g., daily, weekly, custom)
- `schedule` (`jsonb`, custom scheduling rules and target days)
- `photo_mandatory` (`bool`, whether photo proof is required or optional)
- `photo_prompt` (`text`, custom reminder prompt, e.g., "Take a photo of your running shoes")
- `due_date` (`date`, optional milestone target date)
- `due_time` (`time`, target time of day for reminders)
- `streak_current` (`int4`, computed active streak count)
- `streak_longest` (`int4`, computed personal best streak)
- `is_archived` (`bool`, soft deletion flag)
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

#### 3. `habit_logs`
Records every completion attempt and associated photo evidence.
- `id` (`uuid`, Primary Key)
- `habit_id` (`uuid`, Foreign Key -> `habits.id`)
- `user_id` (`uuid`, Foreign Key -> `profiles.id`)
- `log_date` (`date`, target date of completion)
- `timestamp` (`timestamptz`, exact time when proof was taken/submitted)
- `completed_at` (`timestamptz`)
- `photo_url` (`text`, public CDN / storage URL for display)
- `photo_path` (`text`, internal storage bucket reference path)
- `caption` (`text`, user's notes or thoughts attached to the proof)
- `streak_at_log` (`int4`, snapshot of streak length at time of log)
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

#### 4. `habit_albums`
Aggregates logs and visual memories into thematic photo collections.
- `id` (`uuid`, Primary Key)
- `habit_id` (`uuid`, Foreign Key -> `habits.id`)
- `user_id` (`uuid`, Foreign Key -> `profiles.id`)
- `title` (`text`, album title)
- `cover_photo_path` (`text`, path to cover image)
- `photo_count` (`int4`, total photos collected in album)
- `longest_streak` (`int4`, record streak captured in album period)
- `frame_theme` (`text`, aesthetic border/frame style for image showcase)
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

---

## 4. Feature Specifications & User Capabilities

### 4.1 Authentication & Profile Setup
- **Supabase Auth Integration**: Email/Password and OAuth support.
- **User Profile Management**: Timezone detection for accurate date rollover and streak calculation; customizable display name and avatar.

### 4.2 Habit Creation & Customization
- **Flexible Habit Setup**: Define title, icon/emoji, accent color, and target schedule (`jsonb`).
- **Photo Proof Rules**:
  - `photo_mandatory`: Toggle whether completion requires a photo or can be logged directly.
  - `photo_prompt`: Define a prompt (e.g., *"Capture a photo of your desk or notebook"*) displayed when logging.
- **Time & Schedule Rules**: Set daily target times (`due_time`) and optional goal end dates (`due_date`).
- **Archiving**: Soft-delete inactive habits (`is_archived = true`) while preserving historical logs and albums.

### 4.3 Photo Proof Submission & Logging
- **In-App Camera & Gallery Pick**: Capture proof directly via camera or select an existing photo.
- **Image Compression & Storage Upload**: Optimize photos before uploading to Supabase Storage, storing both the `photo_path` and secure `photo_url`.
- **Log Customization**: Add notes/captions (`caption`) to accompany the photo proof.
- **Instant Validation**: Upon submission, record completion timestamp (`completed_at`), calculate active streak, and record `streak_at_log`.

### 4.4 Automated Streak Engine & Analytics
- **Real-Time Streak Tracking**: Automatically increment `streak_current` on daily completion and update `streak_longest` when a personal record is broken.
- **Analytics & Calendar View**:
  - Interactive monthly calendar grid displaying thumbnail photo proofs on completed dates.
  - Streak history graphs and consistency metrics.

### 4.5 Habit Photo Albums & Visual Memory Showcase
- **Automatic Album Generation**: Group proof photos by habit into dedicated visual albums (`habit_albums`).
- **Customizable Frame Themes**: Apply visual frames (`frame_theme`) to highlight milestones.
- **Cover Photo & Highlights**: Select cover images (`cover_photo_path`) and view total photo counts (`photo_count`) and peak streaks (`longest_streak`).

---

## 5. Non-Functional & System Requirements

- **Cross-Platform Readiness**: Smooth user experience across Mobile (iOS/Android) and Web platforms powered by React Native Expo.
- **Row Level Security (RLS)**: Enforce Supabase RLS policies ensuring users can only read, insert, update, and delete their own profiles, habits, logs, and albums (`user_id = auth.uid()`).
- **Image Optimization**: Automatic client-side resize & compression to ensure fast upload times and minimal bandwidth usage.
- **Offline Resiliency**: Cache active habit list and allow deferred photo upload syncing when network connectivity drops.
