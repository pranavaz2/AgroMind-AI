import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import ScreenContainer from '../../components/ScreenContainer';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import {
  addCommunityComment,
  createCommunityPost,
  getCommunityFeed,
  markQuestionResolved,
  toggleCommunityLike,
} from '../../services/communityService';

const FILTERS = [
  { id: 'ALL', label: 'All', icon: 'albums-outline' },
  { id: 'QUESTION', label: 'Questions', icon: 'help-circle-outline' },
  { id: 'POST', label: 'Posts', icon: 'leaf-outline' },
];

function timeAgo(value) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function initials(name = 'Farmer') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'F';
}

export default function CommunityScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [composer, setComposer] = useState({
    type: 'POST',
    title: '',
    body: '',
    cropName: '',
    location: user?.location || '',
    imageUri: null,
  });

  const feedParams = useMemo(() => ({ type: filter }), [filter]);

  const loadFeed = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await getCommunityFeed(feedParams);
      setPosts(data.posts || []);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [feedParams]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function loadMore() {
    if (!hasMore || !nextCursor || isLoading) return;
    const data = await getCommunityFeed({ ...feedParams, cursor: nextCursor });
    setPosts((current) => [...current, ...(data.posts || [])]);
    setNextCursor(data.nextCursor || null);
    setHasMore(Boolean(data.hasMore));
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.82,
    });

    if (!result.canceled) {
      setComposer((current) => ({ ...current, imageUri: result.assets[0].uri }));
    }
  }

  async function submitPost() {
    setIsSubmitting(true);
    try {
      const data = await createCommunityPost(composer);
      setPosts((current) => [data.post, ...current]);
      setComposer({
        type: 'POST',
        title: '',
        body: '',
        cropName: '',
        location: user?.location || '',
        imageUri: null,
      });
      setIsComposerOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLike(postId) {
    const previous = posts;
    setPosts((current) => current.map((post) => (
      post.id === postId
        ? {
            ...post,
            isLikedByMe: !post.isLikedByMe,
            likeCount: post.likeCount + (post.isLikedByMe ? -1 : 1),
          }
        : post
    )));

    try {
      const result = await toggleCommunityLike(postId);
      setPosts((current) => current.map((post) => (
        post.id === postId
          ? { ...post, isLikedByMe: result.liked, likeCount: result.likeCount }
          : post
      )));
    } catch {
      setPosts(previous);
    }
  }

  async function handleComment(postId) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;

    const data = await addCommunityComment(postId, body);
    setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    setPosts((current) => current.map((post) => (
      post.id === postId
        ? {
            ...post,
            commentCount: post.commentCount + 1,
            recentComments: [data.comment, ...(post.recentComments || [])].slice(0, 2),
          }
        : post
    )));
  }

  async function handleResolve(post) {
    const data = await markQuestionResolved(post.id, !post.isResolved);
    setPosts((current) => current.map((item) => (item.id === post.id ? data.post : item)));
  }

  function renderPost({ item }) {
    const isMine = item.author?.id === user?.id;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(item.author?.fullName)}</Text>
          </View>
          <View style={styles.authorBlock}>
            <Text style={styles.authorName}>{item.author?.fullName || 'Farmer'}</Text>
            <Text style={styles.postMeta}>
              {item.location || item.author?.location || 'AgroMind community'} · {timeAgo(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.typePill, item.type === 'QUESTION' && styles.questionPill]}>
            <Ionicons
              name={item.type === 'QUESTION' ? 'help-circle' : 'leaf'}
              size={13}
              color={item.type === 'QUESTION' ? theme.colors.info : theme.colors.primary}
            />
            <Text style={[styles.typeText, item.type === 'QUESTION' && styles.questionText]}>
              {item.type === 'QUESTION' ? 'Question' : 'Post'}
            </Text>
          </View>
        </View>

        {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
        <Text style={styles.postBody}>{item.body}</Text>

        {(item.cropName || item.isResolved) && (
          <View style={styles.tagRow}>
            {item.cropName ? (
              <View style={styles.tag}>
                <Ionicons name="nutrition-outline" size={13} color={theme.colors.warning} />
                <Text style={styles.tagText}>{item.cropName}</Text>
              </View>
            ) : null}
            {item.isResolved ? (
              <View style={[styles.tag, styles.resolvedTag]}>
                <Ionicons name="checkmark-circle" size={13} color={theme.colors.success} />
                <Text style={[styles.tagText, styles.resolvedText]}>Resolved</Text>
              </View>
            ) : null}
          </View>
        )}

        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.postImage} /> : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)} activeOpacity={0.78}>
            <Ionicons
              name={item.isLikedByMe ? 'heart' : 'heart-outline'}
              size={19}
              color={item.isLikedByMe ? theme.colors.danger : theme.colors.textMuted}
            />
            <Text style={styles.actionText}>{item.likeCount}</Text>
          </TouchableOpacity>
          <View style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textMuted} />
            <Text style={styles.actionText}>{item.commentCount}</Text>
          </View>
          {item.type === 'QUESTION' && isMine ? (
            <TouchableOpacity style={styles.resolveButton} onPress={() => handleResolve(item)} activeOpacity={0.8}>
              <Ionicons name={item.isResolved ? 'return-down-back' : 'checkmark'} size={16} color={theme.colors.background} />
              <Text style={styles.resolveText}>{item.isResolved ? 'Reopen' : 'Resolve'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {(item.recentComments || []).map((comment) => (
          <View key={comment.id} style={styles.commentBubble}>
            <Text style={styles.commentAuthor}>{comment.author?.fullName || 'Farmer'}</Text>
            <Text style={styles.commentText}>{comment.body}</Text>
          </View>
        ))}

        <View style={styles.commentInputRow}>
          <TextInput
            value={commentDrafts[item.id] || ''}
            onChangeText={(text) => setCommentDrafts((current) => ({ ...current, [item.id]: text }))}
            placeholder="Answer or comment..."
            placeholderTextColor={theme.colors.textSoft}
            style={styles.commentInput}
          />
          <TouchableOpacity style={styles.sendCommentButton} onPress={() => handleComment(item.id)} activeOpacity={0.8}>
            <Ionicons name="send" size={16} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadFeed({ refresh: true })} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Farmer community</Text>
                <Text style={styles.title}>Share field wisdom</Text>
                <Text style={styles.subtitle}>Ask questions, post crop photos, and help nearby farmers solve problems faster.</Text>
              </View>
              <TouchableOpacity style={styles.composeFab} onPress={() => setIsComposerOpen(true)} activeOpacity={0.84}>
                <Ionicons name="add" size={25} color={theme.colors.background} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => {
                const active = filter === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(item.id)}
                    activeOpacity={0.82}
                  >
                    <Ionicons name={item.icon} size={15} color={active ? theme.colors.background : theme.colors.textMuted} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.mutedText}>Loading community feed...</Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="people-circle-outline" size={44} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.mutedText}>Start the first discussion for your farming community.</Text>
          </View>
        )}
        ListFooterComponent={hasMore ? <ActivityIndicator style={styles.footerLoader} color={theme.colors.primary} /> : null}
      />

      <Modal visible={isComposerOpen} transparent animationType="slide" onRequestClose={() => setIsComposerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.composer}>
            <View style={styles.composerHeader}>
              <Text style={styles.composerTitle}>Create post</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setIsComposerOpen(false)}>
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.segment}>
              {['POST', 'QUESTION'].map((type) => {
                const active = composer.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    onPress={() => setComposer((current) => ({ ...current, type }))}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {type === 'POST' ? 'Post' : 'Question'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {composer.type === 'QUESTION' ? (
              <TextInput
                value={composer.title}
                onChangeText={(title) => setComposer((current) => ({ ...current, title }))}
                placeholder="Short question title"
                placeholderTextColor={theme.colors.textSoft}
                style={styles.input}
              />
            ) : null}

            <TextInput
              value={composer.body}
              onChangeText={(body) => setComposer((current) => ({ ...current, body }))}
              placeholder={composer.type === 'QUESTION' ? 'Describe the problem...' : 'Share an update, tip, or field observation...'}
              placeholderTextColor={theme.colors.textSoft}
              multiline
              style={[styles.input, styles.bodyInput]}
            />

            <View style={styles.inlineInputs}>
              <TextInput
                value={composer.cropName}
                onChangeText={(cropName) => setComposer((current) => ({ ...current, cropName }))}
                placeholder="Crop"
                placeholderTextColor={theme.colors.textSoft}
                style={[styles.input, styles.inlineInput]}
              />
              <TextInput
                value={composer.location}
                onChangeText={(location) => setComposer((current) => ({ ...current, location }))}
                placeholder="Location"
                placeholderTextColor={theme.colors.textSoft}
                style={[styles.input, styles.inlineInput]}
              />
            </View>

            {composer.imageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: composer.imageUri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setComposer((current) => ({ ...current, imageUri: null }))}
                >
                  <Ionicons name="close" size={17} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.composerActions}>
              <TouchableOpacity style={styles.attachButton} onPress={pickImage} activeOpacity={0.82}>
                <Ionicons name="image-outline" size={18} color={theme.colors.info} />
                <Text style={styles.attachText}>Add image</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitButton} onPress={submitPost} disabled={isSubmitting} activeOpacity={0.86}>
                <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={StyleSheet.absoluteFill} />
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <Ionicons name="paper-plane" size={17} color={theme.colors.background} />
                )}
                <Text style={styles.submitText}>Publish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.layout.tabBarBottomPadding,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    maxWidth: 280,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  composeFab: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.glow,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  filterTextActive: {
    color: theme.colors.background,
  },
  postCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.black,
  },
  authorBlock: { flex: 1 },
  authorName: {
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
  postMeta: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
  },
  questionPill: {
    backgroundColor: theme.colors.infoSoft,
  },
  typeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  questionText: {
    color: theme.colors.info,
  },
  postTitle: {
    marginTop: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  postBody: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.warningSoft,
  },
  tagText: {
    color: theme.colors.warning,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  resolvedTag: {
    backgroundColor: theme.colors.successSoft,
  },
  resolvedText: {
    color: theme.colors.success,
  },
  postImage: {
    width: '100%',
    height: 210,
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  actionText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  resolveButton: {
    marginLeft: 'auto',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primary,
  },
  resolveText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.black,
  },
  commentBubble: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
  },
  commentAuthor: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.black,
  },
  commentText: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    color: theme.colors.text,
  },
  sendCommentButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
  },
  loadingBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyBox: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    marginTop: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  mutedText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: theme.spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  composer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    padding: 4,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.round,
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  segmentTextActive: {
    color: theme.colors.background,
  },
  input: {
    minHeight: 48,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  inlineInput: {
    flex: 1,
  },
  previewWrap: {
    marginTop: theme.spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.overlay,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  attachButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.infoSoft,
  },
  attachText: {
    color: theme.colors.info,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  submitButton: {
    minHeight: 46,
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.round,
    overflow: 'hidden',
  },
  submitText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
});
