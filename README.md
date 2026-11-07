# VIMAL College Hub — GitHub + Vercel

A React + Vercel Functions + Supabase academic library with page-level PDF search, student accounts, a ₹10 one-calendar-month unlimited-search pass, and advertising placements.

## Monetisation included

- **Free plan:** 10 searches per signed-in student per day. The database enforces this limit atomically on the server.
- **Monthly pass:** ₹10 one-time payment for unlimited search for one calendar month. It does not auto-renew. A new payment is required after expiry. Early renewal extends the current expiry by one calendar month.
- **Payment security:** Vercel creates the Razorpay order server-side, verifies the checkout HMAC signature, fetches the payment from Razorpay and checks that it is captured, ₹10 and INR before granting membership. A signed `payment.captured` webhook also activates membership if the browser callback is interrupted. Duplicate callbacks cannot extend a pass twice.
- **Ads:** two responsive AdSense placements are ready for your publisher/client ID and ad-slot IDs. Until you have approval and real slot IDs, they show clearly marked sponsor placeholders. Never click your own ads or ask students to click them.

## 1. Create Supabase project

1. Create a project at https://supabase.com.
2. Open SQL Editor and run the complete `supabase/schema.sql` file. This creates resource search tables, membership/payment tables and the server-side search-limit functions.
3. Create a **private** Storage bucket named `academic-pdfs`.
4. In Project Settings → API, copy the Project URL, public anon/publishable key and `service_role` key. The service-role key must remain server-side only.
5. In Authentication → Providers, enable Email. Configure the email template to send a numeric OTP using `{{ .Token }}` (not only a magic link), because the site displays a code-entry field.
6. In Authentication → URL Configuration, add your Vercel production URL and local development URL to the allowed site/redirect URLs.

## 2. Create Razorpay account

1. Create/activate a merchant account at https://razorpay.com and complete its required KYC and bank verification.
2. In Razorpay Dashboard → Account & Settings → API Keys, create **Test Mode** keys first.
3. Add the test `Key ID` and `Key Secret` to Vercel as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Never add the secret to frontend variables or GitHub.
4. In Razorpay Dashboard → Webhooks, add `https://YOUR-VERCEL-DOMAIN/api/razorpay-webhook`.
5. Subscribe to `payment.captured`. Set a strong webhook secret and add it to Vercel as `RAZORPAY_WEBHOOK_SECRET`.
6. Confirm Razorpay's payment capture setting is configured to capture successful payments. The membership code intentionally grants access only after a captured payment.
7. Test a successful payment, failed payment, dismissed checkout, duplicate webhook and expiry/renewal before switching to Live Mode. Switch to Live Mode only after merchant verification and adding the live keys.

The code charges exactly ₹10 (1000 paise) per pass. It is a one-time payment, not an automatic recurring subscription.

## 3. Configure Vercel environment variables

Import the GitHub repository into Vercel and add these variables for Production, Preview and Development as appropriate:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_ADMIN_API_KEY=YOUR_LONG_RANDOM_ADMIN_SECRET
SUPABASE_BUCKET=academic-pdfs
FREE_DAILY_SEARCH_LIMIT=10
RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_RAZORPAY_WEBHOOK_SECRET
```

For ads, after your AdSense account approves the deployed site, add the exact values AdSense gives you:

```env
VITE_ADSENSE_CLIENT=ca-pub-YOUR_PUBLISHER_ID
VITE_ADSENSE_SLOT_TOP=YOUR_TOP_AD_SLOT_ID
VITE_ADSENSE_SLOT_RESULTS=YOUR_RESULTS_AD_SLOT_ID
```

Do not leave sample IDs in place. If the AdSense values are blank, the site displays sponsor placeholders instead of trying to load ads.

After changing environment variables, redeploy the Vercel project.

## 4. Deploy through GitHub

1. Extract this ZIP.
2. Upload all files and folders inside it to the root of a new GitHub repository.
3. In Vercel choose Add New → Project and import that repository.
4. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
5. Add the environment variables above and deploy.

## 5. Admin PDF uploads

Open the deployed website → Admin upload → enter `ADMIN_API_KEY` → fill in the academic details → upload a text-based PDF. Vercel serverless upload limit in this starter is 4 MB. Scanned PDFs require OCR before indexing.

## 6. Ads and legal launch checklist

- Apply to AdSense only after the website has useful original content, navigation, contact details and privacy information. Approval is not guaranteed. Ad placements remain placeholders until you provide approved ad IDs.
- Review and complete `public/privacy.html` and `public/terms.html`: add the operator's legal name, support/grievance contact, retention details, and a clear refund/cancellation policy. Publish these before taking live payments.
- Give students clear notice about email login, search usage counts, payments and advertising technologies. Configure any consent mechanism required for the visitors and advertising products you use. Minimise collected data and restrict access to it.
- Ensure you have permission to distribute question papers, notes and other uploaded copyrighted materials.
- Check tax, invoicing, consumer-protection and payment-gateway requirements for your business circumstances with a qualified Indian professional before launch.

## Important operating notes

- `FREE_DAILY_SEARCH_LIMIT` defaults to 10. The database function enforces it server-side; changing a frontend counter cannot bypass the limit.
- Search requires email OTP sign-in so the free allowance and paid pass are attached to a student account.
- Membership expires after one calendar month, is not auto-renewing and only activates after Razorpay reports a captured ₹10 payment.
- A ₹10 sale is a gross amount. Payment gateway fees and applicable GST on those fees reduce the amount you receive; check the provider's current merchant pricing before launch.
- The `service_role` key and Razorpay secret must never be prefixed with `VITE_`, committed to GitHub or sent to the browser.
- This is an implementation starter, not legal or tax advice. Complete the operator/contact/refund details and test the live merchant configuration before accepting real student payments.
