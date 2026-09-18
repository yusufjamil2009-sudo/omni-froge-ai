# Omni froge ai

🐸 OMNIFROG AI — PART 01

DIRECT BUILD — PRIVATE AI SOFTWARE BUILDER WORKSPACE

IMPORTANT — READ BEFORE MODIFYING ANYTHING

Build the first working version of OMNIFROG AI directly.

This is PART 01 of a larger multi-part build.

DO NOT create a separate "core foundation" project. DO NOT create a temporary prototype that will later be discarded. DO NOT create dummy screens just for demonstration. DO NOT rebuild the application from scratch in later parts.

This PART 01 must create the actual working OmniFrog AI application that future parts will extend.

Future parts will add the API Manager, AI routing, browser AI, 36 agents, supervisor, coding engine, checkpoint/resume system, live preview, GitHub, Vercel, Netlify and other systems.

For this part, build the actual OmniFrog workspace and its private-access system while keeping the architecture modular enough for those future systems to plug into it.

1. PRODUCT IDENTITY

Application name:

OmniFrog AI

Product type:

Personal AI Software Builder / AI Coding Workspace

Core purpose:

OmniFrog AI will eventually allow the user to describe an idea and have AI plan, code, build, test, debug, preview and publish the resulting software project.

The product must feel like a serious professional AI development environment.

It must NOT look like a gaming application.

Visual direction:

premium

futuristic

professional

clean

lightweight

developer-focused

AI-native

responsive

mobile-friendly

desktop-friendly

subtle futuristic animation

no excessive neon

no unnecessary 3D

no heavy visual effects

2. PRIVATE PERSONAL-USE ACCESS

OmniFrog AI is a personal-use application.

DO NOT create:

Guest ID

Guest account

public signup

public registration

social login

unnecessary onboarding account creation

The application must begin with a secure password screen.

Flow:

OPEN OMNIFROG AI ↓ PRIVATE ACCESS SCREEN ↓ ENTER PASSWORD ↓ VERIFY PASSWORD ↓ OMNIFROG WORKSPACE

The password will be supplied by the application owner through a secure deployment environment variable/secret.

DO NOT hard-code the password into frontend source code.

DO NOT expose the password in JavaScript bundles.

DO NOT display the stored password anywhere.

3. PRIVATE ACCESS SCREEN

Create a polished OmniFrog AI private-access screen.

Design:

OmniFrog AI logo/name

subtle futuristic background

clean glass/frosted panel

password input

show/hide password control

unlock button

loading state

incorrect-password state

secure-session state

Suggested copy:

OMNIFROG AI

Private Workspace

"Enter your access password to continue."

Button:

UNLOCK OMNIFROG AI →

Do not reveal whether the password is partially correct.

4. SECURITY REQUIREMENTS

Implement the private access system securely.

Requirements:

server-side password verification

secure session after successful authentication

protected application routes

protected server/API routes

session expiration capability

logout

rate limiting for repeated failed attempts

generic authentication error

no password in client-side source

no password in localStorage

no password in URL

no password in query parameters

no password in logs

no sensitive credentials in console logs

Use the platform's secure environment-variable/secret mechanism for the owner-defined password.

Use a secure session mechanism rather than storing a permanent authentication flag in localStorage.

5. MAIN OMNIFROG WORKSPACE

After successful authentication, show the real OmniFrog AI workspace.

Desktop layout:

LEFT SIDEBAR + MAIN WORKSPACE

Mobile layout:

COMPACT HEADER + MAIN WORKSPACE + RESPONSIVE NAVIGATION

Do not allow horizontal overflow.

The application must fit properly inside mobile viewport widths.

6. SIDEBAR

Create a lightweight professional sidebar.

Brand:

🐸 OmniFrog AI

Navigation:

New Build

Projects

Live Preview

Build Activity

Settings

Some sections can be marked as coming in future parts, but do not create fake functionality.

The navigation architecture must be ready for future modules.

7. MAIN AI BUILDER SCREEN

This is the most important screen of PART 01.

Create a large central AI builder area.

Header:

What do you want to build?

Subtitle:

Describe your idea. OmniFrog AI will turn it into a software project.

Large prompt composer:

Placeholder:

Describe the website, web app, AI app, tool or software you want to build...

The composer must support:

multiline input

long prompts

Enter/Shift+Enter behavior

send/build button

disabled state while processing

loading state

character/token-friendly UI

clear input control

mobile keyboard-friendly layout

Primary button:

BUILD WITH OMNIFROG →

8. LONG / COMPLEX PROMPT READY ARCHITECTURE

Even though the complete AI reasoning engine is coming in later parts, PART 01 must NOT impose an unnecessarily tiny prompt limit.

The input system must be designed for:

long requirements

multi-section instructions

technical specifications

complex application descriptions

large feature lists

constraints

file requirements

UI requirements

backend requirements

Do not silently truncate user input.

If a future backend imposes a model context limit, the application should be able to handle that through context management rather than cutting text arbitrarily.

9. BUILD REQUEST STATE

Create the real request lifecycle/state model that future AI systems can use.

States:

IDLE UNDERSTANDING PLANNING BUILDING TESTING FIXING PREVIEWING COMPLETED FAILED PAUSED

PART 01 does not need to implement every AI capability yet.

However, the workspace must be designed around these states instead of creating a one-off button that cannot be extended.

10. BUILD STATUS AREA

When a build request is submitted, show a professional build-status panel.

Example:

OMNIFROG BUILD

Status: Preparing project...

Activity:

✓ Request received ✓ Project request stored → Preparing build environment → Waiting for AI build engine

This is NOT fake AI output.

Do not pretend that the application generated code when the actual AI engine has not yet been connected.

Clearly distinguish:

real operations

pending integrations

unavailable capabilities

11. PROJECT WORKSPACE

Create the project workspace structure.

Each project should conceptually contain:

project ID

project name

original user request

status

created time

updated time

project files

build state

preview state

activity history

Create the data model/schema in an extensible way.

Do not create unnecessary duplicated databases.

12. PROJECT LIST

Create a Projects screen.

Show:

project name

status

last updated

open project action

Empty state:

No projects yet

Your projects will appear here when you start building.

Do not create fake projects.

13. PROJECT DETAIL WORKSPACE

Create the initial project detail layout.

Structure:

PROJECT HEADER

Project Name
Status

--------------------------------

FILES       BUILD / PREVIEW

--------------------------------

BUILD ACTIVITY


The detailed coding engine will be implemented in later parts.

For now, establish the actual UI architecture without pretending that unavailable functionality is already working.

14. LIVE PREVIEW AREA

Create the actual preview container architecture.

It should support future:

mobile preview

desktop preview

fullscreen preview

responsive preview

preview URL

deployment URL

PART 01 only needs the container/state architecture.

Do not generate fake websites and call them AI-generated previews.

When no preview exists, show:

LIVE PREVIEW

Your project preview will appear here after a successful build.

15. BUILD ACTIVITY

Create a Build Activity panel that will later display real events from AI agents.

Structure:

BUILD ACTIVITY

● Current operation

✓ Completed operation
✓ Completed operation
→ Current operation
○ Pending operation
⚠ Warning
✕ Error


Future events must be able to include:

agent ID

agent name

file being edited

operation

progress

warning

error

checkpoint

provider

model

retry

handoff

Do not hard-code fake activity logs.

16. SETTINGS

Create the Settings structure.

Sections:

General

AI Providers

GitHub

Deployment

Security

Project Settings

The actual API Manager will be implemented in PART 02.

The actual GitHub connection will be implemented later.

The actual Vercel/Netlify connections will be implemented later.

Do not create fake connected states.

17. LOGOUT

Add a secure logout action.

After logout:

OMNIFROG WORKSPACE ↓ SESSION DESTROYED ↓ PRIVATE ACCESS SCREEN

Do not create a guest account after logout.

18. PERFORMANCE REQUIREMENTS

This application is intended to remain lightweight.

DO NOT:

add unnecessary heavy 3D

add unnecessary WebGL

add huge animation libraries

load unused dependencies

duplicate components

duplicate state systems

create multiple competing routing systems

create multiple competing authentication systems

load future AI providers in PART 01

create unnecessary background polling

Use:

lazy loading where appropriate

efficient state updates

component reuse

minimal dependencies

responsive CSS

efficient rendering

The UI should remain smooth on mobile devices and lower-end hardware.

19. RESPONSIVE REQUIREMENTS

Mobile is a first-class target.

Test at least conceptually for:

small Android phones

standard mobile widths

tablets

desktop

large desktop

Requirements:

no horizontal page overflow

no clipped buttons

no oversized fixed-width containers

prompt composer fits mobile screens

sidebar collapses appropriately

preview adapts to available space

touch targets remain usable

text remains readable

20. FUTURE EXTENSIBILITY

Design PART 01 so future parts can plug in without rewriting the application.

Future systems include:

PART 02: API Manager

PART 03: AI Model Router

PART 04: Browser/Open-Source AI

PART 05: UI Generation

PART 06: Coding Engine

PART 07: 36 Agents

PART 08: Supervisor

PART 09: Parallel Agents

PART 10: Checkpoint / Resume / Rate-Limit Handoff

PART 11: Live Agent Activity

PART 12: Build/Test/Debug

PART 13: Live Preview

PART 14: Sandbox

PART 15: GitHub

PART 16: Backend Integrations

PART 17: Project Memory

PART 18: Vercel + Netlify

PART 19: Final Integration / QA / Performance

Do NOT implement these systems prematurely.

Prepare clean extension points for them.

21. DATA / ARCHITECTURE RULE

Keep project data, authentication state, build state and UI state logically separated.

Do not store sensitive credentials in frontend state.

Do not mix future AI provider logic directly into UI components.

Use clean service boundaries so later parts can add providers without rewriting the entire interface.

22. ERROR HANDLING

Create a consistent error-handling system.

Errors should have:

user-safe message

internal error identifier

timestamp

operation

recoverable/non-recoverable state

Never expose:

API secrets

passwords

access tokens

internal credentials

sensitive server information

23. NO FAKE AI

Very important:

Do not create fake AI responses merely to make the UI look functional.

If the actual AI provider is not yet connected in PART 01, show the correct state.

The next build parts will connect the actual AI systems.

24. VISUAL DESIGN

Use a premium futuristic design language.

Primary background:

white / near-white / very light blue-gray

Text:

deep navy

Accents:

electric cyan / ice blue

Optional:

very subtle metallic gold around OmniFrog branding only.

Use:

glass panels

thin borders

soft shadows

subtle gradients

restrained glow

clean cards

smooth micro-interactions

Avoid:

gaming UI

excessive neon

excessive particles

giant 3D objects

distracting animations

heavy visual effects

The interface should feel like a professional AI development laboratory.

25. IMPORTANT DEVELOPMENT RULES

DO NOT:

rebuild this application from scratch in future parts

create a second OmniFrog application

duplicate authentication

duplicate project systems

duplicate routing

duplicate state management

remove working functionality

replace existing functionality unnecessarily

introduce fake AI functionality

hard-code credentials

expose secrets

add unnecessary dependencies

Future changes must EXTEND the existing OmniFrog AI implementation.

26. COMPLETION CHECKLIST

Before marking PART 01 complete, verify:

[ ] OmniFrog AI opens with private password access.

[ ] Password verification is server-side/secure.

[ ] No password is exposed in frontend code.

[ ] No Guest ID exists.

[ ] No public signup exists.

[ ] Successful authentication opens the actual OmniFrog workspace.

[ ] Logout returns to private-access screen.

[ ] Main AI Builder UI exists.

[ ] Long prompts are supported without arbitrary truncation.

[ ] Projects screen exists.

[ ] Project workspace exists.

[ ] Live Preview container exists.

[ ] Build Activity container exists.

[ ] Settings structure exists.

[ ] Mobile layout works.

[ ] Desktop layout works.

[ ] No horizontal overflow.

[ ] No fake AI output is presented as real.

[ ] No unnecessary heavy dependencies are added.

[ ] Existing working systems are not broken.

[ ] Application remains lightweight.

FINAL INSTRUCTION

Build PART 01 directly inside the actual OmniFrog AI application.

Do not create a throwaway prototype.

Do not build an empty foundation.

Build the first real, usable OmniFrog AI workspace now.

After implementation, run the available checks/build validation and fix any errors or regressions before considering PART 01 complete.

Do not implement PART 02+ features yet.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/67546776-73e1-47e5-a4f2-63bf5ccf509b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
