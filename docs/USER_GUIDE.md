# User Guide

This guide covers the three roles. The app is a prototype: its risk estimates describe past course outcomes, are not early warnings, and must not be used to make decisions about students.

## Signing in and creating an account

- **Email and password:** Create an account on the Register page and choose your role (Student or Instructor).
- **Google or GitHub:** On the Register page, pick your role first. From the Login page, a new social account is taken to a "One more step" page to choose Student or Instructor. You make this choice once. After that, your role can only be changed by an admin.
- **Admin accounts** cannot be created in the app. An admin creates the first account with the seed script described in the deployment guide.
- Use the theme toggle in the header to switch between light and dark mode. Sign out from the header.

If the page shows "We could not load your account", your session is still active. Use **Try again**.

## Students

Your dashboard is titled "Welcome back" and shows your outlook.

1. **Link your demo ID.** The app uses a demo student ID from the OULAD sample. Search the ID field, which lists only IDs that are not yet linked to a login, and select yours. Each ID can be linked to one login. If you need a different ID, ask an admin to remove the current link.
2. **Your modules** lists the modules you are enrolled in, from the demo record.
3. **Your outlook** shows a plain-language status for a course, with:
   - **Strengths:** signals that are going well, with a short explanation of each.
   - **Improvement points:** signals to work on, with guidance for each.
   - **Not enough data yet:** shown when the sample does not contain enough information for part of the estimate.

Read the outlook as a prompt to look at your own study habits, not as a prediction of your result.

## Instructors

An admin assigns you modules. You see only those modules. If a module you expect is missing, ask an admin.

1. Open **Your modules** and select a module. Its cohort table lists each enrolled student and their final result.
2. Use the outcome filter (Distinction, Pass, Fail, Withdrawn) to focus on one group. Sort columns by clicking their headers.

If a module shows "No students with this outcome", the filter has no matches. Clear it to see the whole cohort. Modules that are not assigned to you are not shown, and the server refuses requests for them.

## Admins

The admin page has four panels.

**User roles.** Search by name or email and change an account's role between Student and Instructor. Admin accounts are shown read-only. You cannot change your own role. Each change asks for confirmation. Changing an account to Student also removes its module assignments.

**Module assignments.** Choose an instructor, then add or remove modules for them. Modules only become visible to an instructor when assigned here. The instructor picker lists instructor accounts only.

**Linked student accounts.** Shows each linked demo student ID with the name of the linked login. Use **Unlink** to remove a link so the student can connect a different ID. Unlinking asks for confirmation and is recorded in the audit log.

**Audit log.** A read-only list of recent admin actions, newest first. It shows unlinks ("Student N") and role changes ("name: previous → new"). Entries cannot be edited or deleted in the app.

If a role change shows "The role was changed, but module assignments and the audit log could not be updated", the role was already saved, but the audit entry or assignment cleanup did not finish. Select the same new role again to retry. The list may not refresh until the retry succeeds.

## Data and privacy

The sample excludes gender, region, deprivation band and disability, and the model does not use them. Student records come from the OULAD dataset, which is anonymised. Account records hold a name, email, role and an optional profile picture from the sign-in provider.
