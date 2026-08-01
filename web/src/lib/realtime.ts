"use client";

// Live push for notifications over STOMP/SockJS, backed by the notification
// service's WebSocket endpoint. The JWT goes on the STOMP CONNECT frame (the
// SockJS HTTP handshake itself is unauthenticated — see the service's SecurityConfig).
// This is additive to polling, not a replacement: if the socket drops, the next
// poll still catches up, so a flaky connection never loses a notification.

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { triggerUnauthorized } from "./api";
import { NOTIFICATION_API_URL } from "./config";
import { getToken } from "./token";
import type { Notification } from "./notifications";

export function useNotificationSocket(
  userId: string | null,
  onNotification: (notification: Notification) => void,
): void {
  const handlerRef = useRef(onNotification);
  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    const token = getToken();
    if (!userId || !token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${NOTIFICATION_API_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/${userId}`, (message) => {
          handlerRef.current(JSON.parse(message.body) as Notification);
        });
      },
      // The server only ever rejects CONNECT for a missing/invalid token (see
      // WebSocketConfig), so any STOMP error here means the session is stale —
      // end it the same way an HTTP 401 does, instead of retrying forever.
      onStompError: () => {
        client.deactivate();
        triggerUnauthorized();
      },
    });
    client.activate();

    return () => {
      client.deactivate();
    };
  }, [userId]);
}
