<script>
  import { fold } from "@foldjs/svelte";
</script>

<div class="fw-card">
  <div class="fw-name"><span class="fw-dot svelte"></span>Svelte</div>
  <div class="fw-posture">{$fold.posture}</div>
  <div class="fw-meta">
    hinge {$fold.hinge ? `${$fold.hinge.width}×${$fold.hinge.height}` : "none"}
  </div>
  <code>$fold.posture</code>
</div>
