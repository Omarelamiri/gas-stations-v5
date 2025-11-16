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
