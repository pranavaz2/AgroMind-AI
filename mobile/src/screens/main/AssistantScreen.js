import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import ScreenContainer from '../../components/ScreenContainer';
import { theme } from '../../constants/theme';
import {
  askTextAssistant,
  askVoiceAssistant,
  getAssistantConversation,
  getAssistantConversations,
} from '../../services/voiceAssistantService';
import { getStoredLocation } from '../../services/locationService';

const QUICK_PROMPTS = [
  { icon: 'leaf-outline', label: 'Disease advice', text: 'My crop leaves have spots. What should I check first?' },
  { icon: 'water-outline', label: 'Irrigation', text: 'How should I decide when to irrigate this week?' },
  { icon: 'flask-outline', label: 'Fertilizer', text: 'Suggest a safe fertilizer plan for my crop.' },
  { icon: 'partly-sunny-outline', label: 'Weather', text: 'Give me weather-based farming guidance for today.' },
];

function getSpeechLanguage(language) {
  if (language === 'malayalam') return 'ml-IN';
  if (language === 'hindi') return 'hi-IN';
  return 'en-IN';
}

function createWelcomeMessage() {
  return {
    id: 'welcome',
    role: 'ASSISTANT',
    content: 'Namaste. I am your AgroMind farming assistant. Ask me about crop disease, fertilizer, irrigation, pests, soil health, or today\'s weather decisions.',
    metadata: {
      suggestedActions: [
        'Mention crop name and growth stage',
        'Share symptoms, soil condition, and recent weather',
        'Use photos in Scan for visual disease detection',
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

export default function AssistantScreen() {
  const listRef = useRef(null);
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [location, setLocation] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState(null);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('english');

  useEffect(() => {
    async function restore() {
      getStoredLocation().then(setLocation).catch(() => {});

      const data = await getAssistantConversations().catch(() => null);
      const latest = data?.conversations?.[0];
      if (!latest) return;

      const detail = await getAssistantConversation(latest.id).catch(() => null);
      if (detail?.conversation?.messages?.length) {
        setConversationId(detail.conversation.id);
        setMessages(detail.conversation.messages);
      }
    }

    restore();

    return () => {
      Speech.stop();
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
    };
  }, [recording]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    });
  }, [messages, isThinking]);

  const appendChatResult = useCallback((chat) => {
    setConversationId(chat.conversation?.id || conversationId);
    setMessages((current) => {
      const withoutOptimistic = current.filter((message) => message.id !== 'typing' && !message.metadata?.pending);
      return [...withoutOptimistic, ...(chat.messages || [])];
    });
  }, [conversationId]);

  async function submitQuestion(questionText = input) {
    const question = questionText.trim();
    if (!question) return;

    setError('');
    setInput('');
    setIsThinking(true);
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'USER', content: question, createdAt: new Date().toISOString(), metadata: { pending: true } },
      { id: 'typing', role: 'ASSISTANT', content: 'Thinking through your field context...', createdAt: new Date().toISOString(), metadata: { typing: true } },
    ]);

    try {
      const data = await askTextAssistant({
        question,
        language,
        location,
        conversationId,
      });
      appendChatResult(data.conversation);
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== 'typing'));
      setError(err.message || 'AgroMind could not answer right now.');
    } finally {
      setIsThinking(false);
    }
  }

  async function startRecording() {
    setError('');
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone permission to ask by voice.');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(result.recording);
    setIsRecording(true);
  }

  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    setIsThinking(true);
    setMessages((current) => [
      ...current,
      { id: 'typing', role: 'ASSISTANT', content: 'Listening and preparing advice...', createdAt: new Date().toISOString(), metadata: { typing: true } },
    ]);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('Recording file was not created.');

      const data = await askVoiceAssistant({ audioUri: uri, location, conversationId });
      appendChatResult(data.conversation);
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== 'typing'));
      setError(err.message || 'Could not process your voice question.');
    } finally {
      setIsThinking(false);
    }
  }

  function speakMessage(message) {
    if (isSpeakingId === message.id) {
      Speech.stop();
      setIsSpeakingId(null);
      return;
    }

    Speech.stop();
    setIsSpeakingId(message.id);
    Speech.speak(message.content, {
      language: getSpeechLanguage(message.metadata?.language || language),
      pitch: 1,
      rate: 0.92,
      onDone: () => setIsSpeakingId(null),
      onStopped: () => setIsSpeakingId(null),
      onError: () => setIsSpeakingId(null),
    });
  }

  function newChat() {
    Speech.stop();
    setConversationId(null);
    setMessages([createWelcomeMessage()]);
    setError('');
  }

  function renderMessage({ item }) {
    const isUser = item.role === 'USER';
    const metadata = item.metadata || {};

    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {metadata.typing ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.aiText}>{item.content}</Text>
            </View>
          ) : (
            <>
              <Text style={isUser ? styles.userText : styles.aiText}>{item.content}</Text>

              {!isUser && metadata.safetyNotes?.length > 0 && (
                <View style={styles.noteBox}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={theme.colors.warning} />
                  <Text style={styles.noteText}>{metadata.safetyNotes.join(' ')}</Text>
                </View>
              )}

              {!isUser && metadata.suggestedActions?.length > 0 && (
                <View style={styles.actionList}>
                  {metadata.suggestedActions.map((action) => (
                    <View key={action} style={styles.actionItem}>
                      <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.primary} />
                      <Text style={styles.actionItemText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!isUser && metadata.followUpQuestions?.length > 0 && (
                <TouchableOpacity
                  style={styles.followUpChip}
                  onPress={() => setInput(metadata.followUpQuestions[0])}
                  activeOpacity={0.8}
                >
                  <Ionicons name="return-down-forward" size={14} color={theme.colors.info} />
                  <Text style={styles.followUpText}>{metadata.followUpQuestions[0]}</Text>
                </TouchableOpacity>
              )}

              {!isUser && (
                <TouchableOpacity style={styles.speakButton} onPress={() => speakMessage(item)} activeOpacity={0.8}>
                  <Ionicons
                    name={isSpeakingId === item.id ? 'volume-mute' : 'volume-high-outline'}
                    size={15}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.speakText}>{isSpeakingId === item.id ? 'Stop' : 'Listen'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.eyebrow}>AgroMind AI assistant</Text>
            <Text style={styles.title}>Farm Intelligence Chat</Text>
            <Text style={styles.locationText}>{location?.label || 'Set farm location for weather-aware advice'}</Text>
          </View>
          <TouchableOpacity style={styles.newButton} onPress={newChat} activeOpacity={0.82}>
            <Ionicons name="add" size={20} color={theme.colors.background} />
          </TouchableOpacity>
        </View>

        <View style={styles.languageRow}>
          {['english', 'hindi', 'malayalam'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.languageChip, language === item && styles.languageChipActive]}
              onPress={() => setLanguage(item)}
              activeOpacity={0.82}
            >
              <Text style={[styles.languageText, language === item && styles.languageTextActive]}>
                {item[0].toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View style={styles.promptGrid}>
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt.label}
                  style={styles.promptCard}
                  onPress={() => submitQuestion(prompt.text)}
                  activeOpacity={0.84}
                  disabled={isThinking}
                >
                  <Ionicons name={prompt.icon} size={18} color={theme.colors.primary} />
                  <Text style={styles.promptLabel}>{prompt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={17} color={theme.colors.warning} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composerWrap}>
          <LinearGradient
            colors={[theme.colors.surface, theme.colors.backgroundElevated]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.82}
            disabled={isThinking}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic-outline'} size={21} color={theme.colors.background} />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isRecording ? 'Recording...' : 'Ask about crops, fertilizer, irrigation...'}
            placeholderTextColor={theme.colors.textSoft}
            multiline
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isThinking) && styles.sendButtonDisabled]}
            onPress={() => submitQuestion()}
            activeOpacity={0.84}
            disabled={!input.trim() || isThinking}
          >
            {isThinking ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Ionicons name="send" size={18} color={theme.colors.background} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 3,
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
  },
  locationText: {
    marginTop: 3,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },
  newButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: theme.colors.primary,
  },
  languageRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  languageChip: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  languageChipActive: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary,
  },
  languageText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  languageTextActive: {
    color: theme.colors.primary,
  },
  messages: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  promptCard: {
    width: '48%',
    minHeight: 70,
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  promptLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  bubble: {
    maxWidth: '86%',
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
  },
  aiBubble: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderSubtle,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  aiText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  userText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
    fontWeight: theme.typography.weight.semibold,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  noteBox: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningSoft,
  },
  noteText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  actionList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  actionItemText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  followUpChip: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.infoSoft,
  },
  followUpText: {
    flex: 1,
    color: theme.colors.info,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.semibold,
  },
  speakButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
  },
  speakText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  errorBox: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningSoft,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  errorText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
  },
  composerWrap: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  micButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
  },
  micButtonActive: {
    backgroundColor: theme.colors.danger,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 22,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
});
