#include <stdio.h>
#include <stdlib.h>

#include <gtk/gtk.h>


int main(int argc, char **argv)
{
    GtkWidget *window;
    GtkWidget *vbox;
    GtkWidget *button;

    gtk_init(&argc, &argv);

    window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_container_set_border_width(GTK_CONTAINER(window), 10);
    g_signal_connect(window, "delete_event", (GCallback)gtk_main_quit, 0);

    vbox = gtk_vbox_new(TRUE, 0);
    gtk_container_add(GTK_CONTAINER(window), vbox);

    button = gtk_button_new_with_label("Hide");
    gtk_box_pack_start(GTK_BOX(vbox), button, TRUE,TRUE, 0);
    g_signal_connect_swapped(button, "clicked",
    (GCallback)gtk_widget_hide, window);

    button = gtk_button_new_from_stock(GTK_STOCK_QUIT);
    gtk_box_pack_start(GTK_BOX(vbox), button, TRUE,TRUE, 0);
    g_signal_connect(button, "clicked", (GCallback)gtk_main_quit, 0);

    gtk_window_set_decorated(GTK_WINDOW(window), FALSE);

    // gtk_window_set_default_size(GTK_WINDOW(window),500,500);

    // gtk_window_stick(GTK_WINDOW(window)); /* on all desktops or not */

    gtk_window_set_keep_above(GTK_WINDOW(window), TRUE);

    //gtk_window_set_keep_below(GTK_WINDOW(window),TRUE);

    gtk_window_set_skip_taskbar_hint(GTK_WINDOW(window), TRUE);
    gtk_window_set_skip_pager_hint(GTK_WINDOW(window), TRUE);

    gtk_window_move(GTK_WINDOW(window), 100, 100);

    // gtk_window_set_opacity(GTK_WINDOW(window), 0); /* not working hmmmm*/

    gtk_widget_show_all(window);

    gtk_main();

    return (EXIT_SUCCESS);
}
