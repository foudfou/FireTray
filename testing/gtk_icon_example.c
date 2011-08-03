#include <stdio.h>

#include <gtk/gtk.h>
#include "firefox.xpm"

void tray_icon_on_click(GtkStatusIcon *status_icon, 
                        gpointer user_data)
{
        printf("Clicked on tray icon\n");
}

void tray_icon_on_menu(GtkStatusIcon *status_icon, guint button, 
                       guint activate_time, gpointer user_data)
{
        printf("Popup menu\n");
}

static GtkStatusIcon *create_tray_icon() {
        GtkStatusIcon *tray_icon;

        tray_icon = gtk_status_icon_new();
        g_signal_connect(G_OBJECT(tray_icon), "activate", 
                         G_CALLBACK(tray_icon_on_click), NULL);
        g_signal_connect(G_OBJECT(tray_icon), 
                         "popup-menu",
                         G_CALLBACK(tray_icon_on_menu), NULL);

        /* GdkPixbuf *default_icon = gdk_pixbuf_new_from_xpm_data(firefox_xpm); */

        /* gtk_status_icon_set_from_pixbuf(GTK_STATUS_ICON(tray_icon), */
        /*                                 GDK_PIXBUF(default_icon)); */
        const gchar *default_icon_filename = "firefox32.png";
        gtk_status_icon_set_from_file(tray_icon,
                                      default_icon_filename);
        gtk_status_icon_set_tooltip(tray_icon, 
                                    "Example Tray Icon");
        gtk_status_icon_set_visible(tray_icon, TRUE);

        return tray_icon;
}

/*
- Hide/Show window to avoid minimizing it to the task bar (yes, use gtk_widget_hide() and gtk_widget_show()) when the user clicks on the system tray icon
- Listen to the "window-state-event" (GObject's signal) to detect when minimizing and, instead of doing that, hide the window (ie, "minimize to the tray").
*/

/* This callback quits the program */
gint delete_event( GtkWidget *widget,
                   GdkEvent *event,
                   gpointer
                   data )
{
  gtk_main_quit ();
  return FALSE;
}

static void winShowHide(GtkMenuItem *item, gpointer window) 
{
  /* GdkWindow * tl_window = gdk_window_get_toplevel((GdkWindow*)window); */

  /* GdkWindowState ws = gdk_window_get_state((GdkWindow*)tl_window); */
  /* printf("GdkWindowState: %d", ws); */

  gdk_window_hide(window->window);
  /* gtk_widget_show(GTK_WIDGET(window)); */
  /* gtk_widget_hide(GTK_WIDGET(window)); */
}

int main(int argc, char **argv) {
        GtkStatusIcon *tray_icon;

        gtk_init(&argc, &argv);
        tray_icon = create_tray_icon();
    
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title (GTK_WINDOW (window), "GtkStatusIcon Example");
    gtk_widget_set_size_request (window, 200, -1);

    /* Set a handler for delete_event that immediately exits GTK. */
    g_signal_connect (G_OBJECT (window), "delete_event",
                      G_CALLBACK (delete_event), NULL);

    g_signal_connect(G_OBJECT(tray_icon), "activate", G_CALLBACK(winShowHide), window);

    gtk_widget_show_all (window);

        gtk_main();

        return 0;
}
