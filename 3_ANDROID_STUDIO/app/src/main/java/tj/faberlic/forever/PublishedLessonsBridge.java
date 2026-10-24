package tj.faberlic.forever;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.MetadataChanges;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Independently replaceable Firestore adapter. No credentials or admin access in the app. */
public final class PublishedLessonsBridge {
    private static final String TAG = "FFPublishedLessons";
    private static final String SYNC_VERSION = "CMS-10";
    private final Activity activity;
    private final WebView webView;
    private ListenerRegistration subscription;
    private ListenerRegistration taxonomySubscription;
    private ListenerRegistration liveSubscription;
    private ListenerRegistration materialsSubscription;
    private boolean disposed;

    public PublishedLessonsBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** Invoked only by our bundled, trusted file:///android_asset WebView. */
    @JavascriptInterface public void subscribe() {
        activity.runOnUiThread(() -> {
            if (disposed) return;
            if (subscription != null) subscription.remove();
            // Required by Firestore rules: ordinary clients may query published lessons only.
            Query query = FirebaseFirestore.getInstance().collection("lessons")
                .whereEqualTo("status", "published");
            send("status", "Подключение к Firebase… (" + SYNC_VERSION + ")");
            Log.i(TAG, "Subscription started " + SYNC_VERSION);
            subscribeTaxonomy();
            subscribeContent();
            subscription = query.addSnapshotListener(MetadataChanges.INCLUDE, (snapshot, error) -> {
                if (disposed) return;
                if (error != null) {
                    Log.w(TAG, "Could not load lessons", error);
                    String code = error instanceof FirebaseFirestoreException
                        ? ((FirebaseFirestoreException) error).getCode().name() : "UNKNOWN";
                    send("failure", "Firebase " + code + ": видео не загружены. (" + SYNC_VERSION + ")");
                    return;
                }
                if (snapshot == null) {
                    send("failure", "Firebase вернул пустой ответ. (" + SYNC_VERSION + ")");
                    return;
                }
                if (snapshot.isEmpty() && snapshot.getMetadata().isFromCache()) {
                    // Empty offline cache does not mean the server has no published lessons.
                    send("status", "Ожидание ответа сервера Firebase… (" + SYNC_VERSION + ")");
                    return;
                }
                Log.i(TAG, SYNC_VERSION + ": Firestore rows=" + snapshot.size()
                        + ", cache=" + snapshot.getMetadata().isFromCache());
                JSONArray lessons = new JSONArray();
                if (snapshot != null) {
                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        JSONObject item = new JSONObject();
                        try {
                            item.put("id", doc.getId());
                            putString(item, doc, "title");
                            putString(item, doc, "youtubeId");
                            putString(item, doc, "description");
                            putString(item, doc, "categoryId");
                            putString(item, doc, "leafCategoryId");
                            putString(item, doc, "groupId");
                            putString(item, doc, "topicId");
                            putString(item, doc, "language");
                            putString(item, doc, "orientation");
                            item.put("order", doc.getLong("order") == null ? 0 : doc.getLong("order"));
                            item.put("createdAt", doc.getTimestamp("createdAt") == null ? 0 :
                                doc.getTimestamp("createdAt").toDate().getTime());
                            lessons.put(item);
                        } catch (JSONException jsonError) {
                            Log.w(TAG, "Bad lesson payload", jsonError);
                        }
                    }
                }
                send("receive", lessons.toString());
            });
        });
    }

    private void subscribeTaxonomy() {
        if (taxonomySubscription != null) taxonomySubscription.remove();
        taxonomySubscription = FirebaseFirestore.getInstance().collection("taxonomy")
            .document("catalog").addSnapshotListener((snapshot, error) -> {
                if (disposed || error != null || snapshot == null || !snapshot.exists()) return;
                Object raw = snapshot.get("items");
                if (!(raw instanceof java.util.List)) return;
                JSONArray array = new JSONArray((java.util.List<?>) raw);
                String js = "window.FFCategoryCMS && window.FFCategoryCMS.receive(" +
                    JSONObject.quote(array.toString()) + ")";
                activity.runOnUiThread(() -> {
                    if (!disposed) webView.evaluateJavascript(js, null);
                });
            });
    }

    /** CMS10: separate read-only subscriptions, published documents only. */
    private void subscribeContent() {
        if (liveSubscription != null) liveSubscription.remove();
        if (materialsSubscription != null) materialsSubscription.remove();
        liveSubscription = FirebaseFirestore.getInstance().collection("liveStreams")
            .whereEqualTo("status", "published")
            .addSnapshotListener((snapshot, error) -> sendContentSnapshot("receiveLive", "errorLive", snapshot, error, true));
        materialsSubscription = FirebaseFirestore.getInstance().collection("materials")
            .whereEqualTo("status", "published")
            .addSnapshotListener((snapshot, error) -> sendContentSnapshot("receiveMaterials", "errorMaterials", snapshot, error, false));
    }

    private void sendContentSnapshot(String receiver, String onError,
                                     com.google.firebase.firestore.QuerySnapshot snapshot,
                                     FirebaseFirestoreException error, boolean live) {
        if (disposed) return;
        if (error != null) {
            Log.w(TAG, "Content sync failed: " + receiver, error);
            sendContent(onError, "Firebase: " + error.getCode().name());
            return;
        }
        if (snapshot == null) return;
        if (snapshot.isEmpty() && snapshot.getMetadata().isFromCache()) return;
        JSONArray list = new JSONArray();
        for (DocumentSnapshot doc : snapshot.getDocuments()) {
            try {
                JSONObject item = new JSONObject();
                item.put("id", doc.getId());
                putString(item, doc, "title");
                putString(item, doc, "description");
                putString(item, doc, "language");
                if (live) {
                    putString(item, doc, "host");
                    putString(item, doc, "youtubeId");
                    putString(item, doc, "phase");
                    Object when = doc.get("scheduledAtMs");
                    item.put("scheduledAtMs", when instanceof Number ? ((Number) when).longValue() : 0);
                } else {
                    putString(item, doc, "url");
                    putString(item, doc, "type");
                }
                list.put(item);
            } catch (JSONException exception) {
                Log.w(TAG, "Bad CMS10 content", exception);
            }
        }
        sendContent(receiver, list.toString());
    }

    private void sendContent(String method, String payload) {
        String js = "window.FFContentModules && window.FFContentModules." + method +
            "(" + JSONObject.quote(payload) + ")";
        activity.runOnUiThread(() -> {
            if (!disposed) webView.evaluateJavascript(js, null);
        });
    }

    private static void putString(JSONObject item, DocumentSnapshot doc, String field) throws JSONException {
        Object raw = doc.get(field);
        item.put(field, raw instanceof String ? raw : "");
    }

    private void send(String method, String payload) {
        // JSON-quote the payload: never concatenate untrusted lesson text into executable JS.
        String js = "window.FFRemoteLessons && window.FFRemoteLessons." + method +
                    "(" + JSONObject.quote(payload) + ")";
        activity.runOnUiThread(() -> { if (!disposed) webView.evaluateJavascript(js, null); });
    }

    public void close() {
        disposed = true;
        if (subscription != null) {subscription.remove(); subscription = null;}
        if (taxonomySubscription != null) {taxonomySubscription.remove(); taxonomySubscription = null;}
        if (liveSubscription != null) {liveSubscription.remove(); liveSubscription = null;}
        if (materialsSubscription != null) {materialsSubscription.remove(); materialsSubscription = null;}
    }
}
