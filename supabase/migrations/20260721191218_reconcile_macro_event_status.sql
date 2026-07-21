-- Forward-only reconciliation for the runtime macro release lifecycle.

alter table public.macro_events
  drop constraint if exists macro_events_status_check;

alter table public.macro_events
  add constraint macro_events_status_check check (
    status in (
      'scheduled',
      'imminent',
      'in_progress',
      'checking',
      'released_pending_actual',
      'actual_available',
      'released',
      'document_released',
      'meeting_completed',
      'official_check_needed',
      'delayed',
      'stale',
      'past'
    )
  );
