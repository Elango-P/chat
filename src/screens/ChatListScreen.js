import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { supabase } from "../utils/supabase";
import {
  MessageSquare,
  User,
  ChevronRight,
  LogOut,
  Shield,
} from "lucide-react-native";

export default function ChatListScreen({ user, onSelectChat }) {
  const [conversations, setConversations] = useState([]);
  console.log("---->>>>>>> ~ conversations:", conversations);
  const [loading, setLoading] = useState(true);

  // Admin ID for portfolio
  const ADMIN_ID = "53763d87-db39-4c5d-abd9-99b301e56b89";
  const isAdmin = user?.id === ADMIN_ID;

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages to update the list
    const channel = supabase
      .channel("chat-list-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => fetchConversations(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchConversations = async () => {
    try {
      // Fetch latest messages for each unique sender/receiver combination
      // Since it's a portfolio app, visitors chat with Admin.
      // Admin sees list of all users.
      // Users see only Admin.

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by user ID
      const grouped = {};
      const userIdsToFetch = new Set();

      data.forEach((msg) => {
        const otherId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (otherId) userIdsToFetch.add(otherId);

        if (!grouped[otherId]) {
          grouped[otherId] = {
            id: otherId,
            lastMessage: msg.message,
            timestamp: msg.created_at,
            isAdminReply: msg.is_admin_reply,
            displayName: otherId === ADMIN_ID ? "Portfolio Admin" : "User",
          };
        }
      });

      // Fetch user profiles for better names
      if (userIdsToFetch.size > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("users")
          .select("id, full_name, email, profile_photo")
          .in("id", Array.from(userIdsToFetch));

        if (!profileError && profiles) {
          profiles.forEach((p) => {
            if (grouped[p.id]) {
              grouped[p.id].displayName =
                p.id === ADMIN_ID
                  ? "Portfolio Admin"
                  : p.full_name ||
                    p.email?.split("@")[0] ||
                    `User ${p.id.substring(0, 5)}`;
              grouped[p.id].avatar = p.profile_photo;
            }
          });
        }
      }

      setConversations(Object.values(grouped));
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.signOut();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => onSelectChat(item.id)}
    >
      <View style={styles.avatar}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : item.id === ADMIN_ID ? (
          <Shield color="#00a884" size={24} />
        ) : (
          <User color="#8696a0" size={24} />
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.chatFooter}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          <ChevronRight color="#3b4a54" size={20} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#202c33" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.headerTitle}>
            {user?.user_metadata?.full_name ||
              user?.email?.split("@")[0] ||
              "User"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <LogOut color="#8696a0" size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00a884" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageSquare color="#3b4a54" size={64} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              {!isAdmin && (
                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={() => onSelectChat(ADMIN_ID)}
                >
                  <Text style={styles.startChatButtonText}>
                    Chat with Admin
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111b21", // WhatsApp dark main background
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#202c33",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#e9edef",
  },
  welcomeText: {
    fontSize: 14,
    color: "#8696a0",
    marginBottom: 2,
  },
  list: {
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222d34",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#202c33",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatInfo: {
    flex: 1,
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9edef",
  },
  timestamp: {
    fontSize: 12,
    color: "#8696a0",
  },
  chatFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#8696a0",
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: "#8696a0",
    fontSize: 16,
    marginTop: 16,
  },
  startChatButton: {
    marginTop: 20,
    backgroundColor: "#00a884",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startChatButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
