# Temporary owner admin setup

The owner registration link is intentionally disabled by default. Enable it
only during the initial account setup, then remove the setting or change it to
`false` and redeploy.

Set these Vercel variables for **Production**:

```text
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_BOOTSTRAP_EMAIL=rechel@gmail.com
ADMIN_BOOTSTRAP_SECRET=<a separate random secret with at least 32 characters>
```

The existing `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are also required. Open
`/admin/login`, select **One-time owner setup**, enter the owner password and
setup code, then sign in normally. The server creates or links the Supabase
Auth account and activates the matching `staff_users` row as `admin`.

After successful registration:

1. Sign in once at `/admin/login` to confirm access.
2. Disable `ADMIN_BOOTSTRAP_ENABLED` in Vercel.
3. Remove `ADMIN_BOOTSTRAP_SECRET` and redeploy.

When disabled, `/admin/bootstrap` redirects back to the normal staff sign-in
page and the setup link is hidden.
