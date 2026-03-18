# installation :

npx create-next-app gas-stations-v5 --typescript --tailwind --eslint

cd gas-stations-v5

npm install @react-google-maps/api@^2.20.7 @types/google.maps@^3.58.1 firebase@^12.1.0 next@15.4.6 react@19.1.0 react-dom@19.1.0 react-firebase-hooks@^5.1.1 recharts@^3.1.2

npm install --save-dev @eslint/eslintrc@^3 @types/node@^20 @types/react@^19 @types/react-dom@^19 autoprefixer@^10.4.21 eslint@^9 eslint-config-next@15.4.6 postcss@^8.5.6 tailwindcss@^3.4.17 typescript@^5

npx tailwindcss init -p


# to do list 


1-overview of code and files (security, delete, optimize)


2- wrap authentification pages 



# In case you want to add more firebase users :
   // API usage tracking - only allow reads for trusted user
    match /api_usage/{usageId} {
      allow read: if isTrustedUser();
      allow write: if false; // Only backend should write
    }

# manual
What still requires manual setup (Step 5)
5) Firestore Security Rules + Admin Claims (not auto-applicable)
This step cannot be fully applied via code changes alone. The remaining required actions are:

Run the one-time script to assign admin claims to the 3 user accounts (as suggested).
Update Firestore security rules to enforce admin-only access where needed.
I can provide exact script + rules snippets if you want, but they require running in your Firebase project (not something I can do purely via repo edits).

If you want, I can now:

Provide a complete Firestore rules snippet (based on your schema).
Provide the exact script / command you should run to set the admin claims for those users.
Adjust the redirect target for non-admin users (e.g., to a specific “Not allowed” page).


add users
DirM@2026
Ali@2025