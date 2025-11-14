# Integration Tests - User Story 1: Control Panel & Bot Lifecycle

This document provides manual integration test procedures for Phase 3 User Story 1 features.

## Prerequisites

Before running these tests, ensure:

1. **Backend Running**: Encore dev server running on port 4000
   ```bash
   cd packages/api
   bun run encore:dev
   ```

2. **Frontend Running**: Next.js dev server running on port 3000
   ```bash
   cd apps/web
   bun run dev
   ```

3. **Database**: PostgreSQL accessible with Drizzle schema applied
4. **MEXC Credentials**: Valid API key and secret configured as Encore secrets

## Test Suite

### T049: Configuration Creation Flow (UI → Encore → DB → UI Refresh)

**Objective**: Verify end-to-end configuration creation with optimistic updates

**Steps**:
1. Open browser to `http://localhost:3000`
2. Click "New Configuration" button
3. Fill in the form:
   - Name: "Test Config 1"
   - Add symbols: BTCUSDT, ETHUSDT (press Enter or click + after each)
   - Quote Amount: 100
   - Max Trades/Hr: 10
   - Max Daily Spend: 1000
   - Recv Window: 1000
   - Safety Enabled: ON
4. Click "Create Configuration"

**Expected Results**:
- ✅ Form submits without errors
- ✅ Dialog closes automatically
- ✅ New configuration appears in the list immediately (optimistic update)
- ✅ Configuration persists after page refresh
- ✅ Created timestamp shows "just now" or similar
- ✅ All entered values match what was submitted

**Verification**:
```bash
# Check database
cd packages/db
bunx drizzle-kit studio
# Navigate to bot_configurations table, verify new record exists
```

**Pass Criteria**: Configuration visible in UI and database with correct values

---

### T050: Bot Start Command (Status Transitions, Heartbeat)

**Objective**: Verify bot starts successfully with valid configuration

**Steps**:
1. Ensure at least one configuration exists (from T049)
2. In the Bot Control Panel:
   - Select configuration from dropdown
   - Click "Start Bot" button
3. Observe status indicator

**Expected Results**:
- ✅ "Start Bot" button becomes disabled during transition
- ✅ Status changes from "Stopped" → "Starting" → "Running"
- ✅ Status indicator dot turns green
- ✅ Heartbeat timestamp updates (refreshes every 5 seconds via polling)
- ✅ "Stop Bot" button becomes enabled
- ✅ "Start Bot" button remains disabled while running

**Verification**:
```bash
# Check bot_runs table
# Verify status='running', started_at is recent, heartbeat updates
```

**API Call Check** (DevTools Network tab):
- Request: `POST /bot/start` with `configurationId`
- Response: `200 OK` with run details
- Latency: <2 seconds

**Pass Criteria**: Bot transitions to running state, heartbeat updates every 5s

---

### T051: Bot Stop Command (Status Transitions, No New Orders)

**Objective**: Verify graceful shutdown stops bot and prevents new trades

**Steps**:
1. Ensure bot is running (from T050)
2. Click "Stop Bot" button
3. Observe status transition

**Expected Results**:
- ✅ "Stop Bot" button becomes disabled during transition
- ✅ Status changes from "Running" → "Stopping" → "Stopped"
- ✅ Status indicator dot turns gray/red
- ✅ Heartbeat stops updating
- ✅ "Start Bot" button becomes enabled
- ✅ "Stop Bot" button remains disabled while stopped

**Verification**:
```bash
# Check bot_runs table
# Verify status='stopped', stopped_at is recent
```

**API Call Check**:
- Request: `POST /bot/stop`
- Response: `200 OK`
- Latency: <2 seconds

**Pass Criteria**: Bot transitions to stopped state, no new heartbeats

---

### T052: Start/Stop Latency (<2s Requirement)

**Objective**: Verify bot control commands complete within 2 seconds

**Tools**: Chrome DevTools Network tab

**Steps**:
1. Open DevTools (F12) → Network tab
2. Clear network log
3. Start bot and measure time:
   - Filter by `/bot/start`
   - Note "Time" column value
4. Clear network log
5. Stop bot and measure time:
   - Filter by `/bot/stop`
   - Note "Time" column value

**Expected Results**:
- ✅ `POST /bot/start` completes in <2000ms
- ✅ `POST /bot/stop` completes in <2000ms
- ✅ No timeout errors (504)
- ✅ No server errors (500)

**Network Timing Breakdown**:
- Queueing: <50ms
- DNS Lookup: <50ms  
- TCP Connection: <100ms
- Request Sent: <50ms
- Waiting (TTFB): <1500ms
- Content Download: <50ms

**Pass Criteria**: Both start and stop complete <2s under normal network conditions

---

### T053: Secrets Validation Failure (Missing Credentials)

**Objective**: Verify proper error handling when MEXC credentials are invalid/missing

**Prerequisites**: 
- Remove or invalidate MEXC API credentials

**Steps**:
1. Ensure MEXC secrets are NOT set or are invalid:
   ```bash
   # For local Encore
   encore secret set --type local MexcApiKey "invalid_key"
   encore secret set --type local MexcApiSecret "invalid_secret"
   ```
2. Try to start the bot
3. Observe error handling

**Expected Results**:
- ✅ Bot fails to start
- ✅ Error message displayed in UI: "MEXC credentials invalid or missing"
- ✅ Status remains "Stopped" or transitions to "Failed"
- ✅ Error details visible in Bot Control Panel
- ✅ User can dismiss error and retry

**Verification**:
```bash
# Check logs
encore logs
# Should show secret validation error
```

**Error Response**:
- Status: `400 Bad Request` or `401 Unauthorized`
- Body: `{ "error": "Invalid MEXC credentials" }`

**Pass Criteria**: Clear error message, no crash, bot remains stoppable

---

## Test Completion Checklist

- [ ] T049: Configuration creation flow works end-to-end
- [ ] T050: Bot starts successfully, heartbeat updates
- [ ] T051: Bot stops gracefully, no new orders
- [ ] T052: Start/stop latency <2 seconds verified
- [ ] T053: Secrets validation error handled properly

## Common Issues & Troubleshooting

### Issue: Configuration doesn't appear in list
- Check browser console for React Query errors
- Verify Encore API is running (`curl http://localhost:4000/configurations`)
- Check database connection in Drizzle Studio

### Issue: Bot won't start
- Check Encore logs for errors
- Verify MEXC credentials are set: `encore secret list`
- Check configuration has valid symbols

### Issue: High latency (>2s)
- Check network conditions (WiFi vs ethernet)
- Verify no CPU throttling
- Check Encore API isn't in debug mode
- Verify database connection isn't slow

### Issue: Heartbeat not updating
- Check React Query polling interval (should be 5s)
- Verify bot status is actually "running"
- Check browser DevTools Network tab for failed requests

## Success Metrics

All tests passing indicates:
- ✅ User Story 1 MVP is functional
- ✅ Frontend-backend integration works
- ✅ Database persistence is correct
- ✅ Real-time updates via polling work
- ✅ Error handling is user-friendly
- ✅ Performance meets requirements (<2s)

## Next Steps After Tests Pass

1. Mark T049-T053 as complete in `tasks.md`
2. Proceed to Phase 4 (Listing Detection & Trading)
3. Consider adding automated E2E tests with Playwright
4. Document any edge cases discovered during testing
