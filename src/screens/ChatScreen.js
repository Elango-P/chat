import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  Image,
  Modal,
} from "react-native";
import { supabase } from "../utils/supabase";
import {
  Send,
  ArrowLeft,
  MessageSquare,
  Shield,
  LogOut,
  X,
} from "lucide-react-native";
import DeviceInfo from "react-native-device-info";
// import { Notifications } from 'react-native-notifications'; // Needs native setup

export default function ChatScreen({ user, recipientId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!user);
  const [isTyping, setIsTyping] = useState(false);
  const [recipientName, setRecipientName] = useState("Loading...");
  const [recipientAvatar, setRecipientAvatar] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const flatListRef = useRef();

  // Admin ID for portfolio (replace with actual if dynamic)
  const ADMIN_ID = "53763d87-db39-4c5d-abd9-99b301e56b89";

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.id);
      fetchMessages();
      fetchRecipientName();
      subscribeToMessages();
      setLoading(false);
    }
  }, [user, recipientId]);

  const fetchRecipientName = async () => {
    if (!recipientId) return;
    if (recipientId === ADMIN_ID) {
      setRecipientName("Portfolio Admin");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("full_name, email, profile_photo")
        .eq("id", recipientId)
        .single();

      if (!error && data) {
        setRecipientName(data.full_name || data.email?.split("@")[0] || "User");
        setRecipientAvatar(data.profile_photo);
      } else {
        setRecipientName(`User ${recipientId.substring(0, 5)}`);
        setRecipientAvatar(null);
      }
    } catch (e) {
      setRecipientName("User");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchMessages = async () => {
    if (!recipientId) return;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: false });

    if (error) console.error("Fetch error:", error);
    else setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel("mobile-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new;
          const isRelevant =
            (m.sender_id === user.id && m.receiver_id === recipientId) ||
            (m.sender_id === recipientId && m.receiver_id === user.id);

          if (!isRelevant) return;

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((msg) => msg.id === m.id)) return prev;
            return [m, ...prev];
          });
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    Keyboard.dismiss();

    const payload = {
      sender_id: user.id,
      receiver_id: recipientId,
      message: messageText,
      is_admin_reply: user.id === ADMIN_ID,
    };

    // Optimistic update
    const tempId = Date.now().toString();
    const optimisticMsg = {
      id: tempId,
      ...payload,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMsg, ...prev]);

    try {
      // Use the Next.js API to ensure push notifications are triggered
      const response = await fetch(
        "https://wktosroqlanmjwbanssy.supabase.co/api/chat/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        // If API fails, fallback to direct supabase insert
        console.warn("API broadcast failed, falling back to direct insert");
        await supabase.from("chat_messages").insert(payload);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic update on error if needed
    }
  };

  async function registerForPushNotificationsAsync(userId) {
    // For purely native, push notifications require extensive native setup
    // in MainActivity/AppDelegate and Firebase configuration.
    try {
      const model = await DeviceInfo.getModel();
      const systemName = await DeviceInfo.getSystemName();
      const systemVersion = await DeviceInfo.getSystemVersion();

      console.log("Registering device:", model, systemName, systemVersion);

      // Placeholder: In a real native app, you'd get the FCM/APNS token here
      const token = "native-token-placeholder";

      // Save device info to DB
      await supabase.from("mobile_push_tokens").upsert(
        {
          user_id: userId,
          push_token: token,
          device_info: {
            model: model,
            os: systemName,
            version: systemVersion,
          },
        },
        { onConflict: "user_id,push_token" },
      );
    } catch (e) {
      console.error("Native device info error:", e);
    }
  }

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {item.attachment_url ? (
            <TouchableOpacity
              onPress={() => setSelectedImage(item.attachment_url)}
              activeOpacity={0.9}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.attachment_url }}
                  style={styles.attachedImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          ) : item.message?.match(/\.(jpeg|jpg|gif|png|webp)/i) &&
            item.message?.startsWith("http") ? (
            <TouchableOpacity
              onPress={() => setSelectedImage(item.message)}
              activeOpacity={0.9}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.message }}
                  style={styles.attachedImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          ) : null}
          {item.message &&
            !(
              item.message?.match(/\.(jpeg|jpg|gif|png|webp)/i) &&
              item.message?.startsWith("http")
            ) && <Text style={styles.messageText}>{item.message}</Text>}
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00a884" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#202c33" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            {recipientAvatar ? (
              <Image
                source={{ uri: recipientAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Shield color="#00a884" size={24} />
            )}
          </View>
          <View>
            <Text style={styles.headerTitle}>{recipientName}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
      </View>

      {/* Message List */}
      <View style={{ flex: 1, backgroundColor: "#0b141a" }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          inverted
          initialNumToRender={15}
        />
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor="#8696a0"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
          </View>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send color="#fff" size={22} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          <SafeAreaView style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSelectedImage(null)}
            >
              <X color="#fff" size={30} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b141a", // WhatsApp dark chat background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b141a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#202c33",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111b21",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#00a884",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  headerTitle: {
    color: "#e9edef",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerStatus: {
    color: "#00a884",
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageWrapper: {
    marginVertical: 4,
    width: "100%",
  },
  myMessageWrapper: {
    alignItems: "flex-end",
  },
  theirMessageWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: "85%",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  myBubble: {
    backgroundColor: "#005c4b", // WhatsApp dark my message color
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: "#202c33", // WhatsApp dark their message color
    borderTopLeftRadius: 2,
  },
  messageText: {
    color: "#e9edef",
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    color: "#8696a0",
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  attachedImage: {
    width: 240,
    height: 180,
    borderRadius: 8,
    marginBottom: 4,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111b21",
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: "100%",
    height: "80%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#202c33",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 4,
    maxHeight: 120,
  },
  input: {
    color: "#e9edef",
    fontSize: 16,
    paddingTop: Platform.OS === "ios" ? 8 : 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00a884",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    padding: 4,
  },
});
