/* pkg-config --libs --cflags gtk+-2.0 */

#include <gtk/gtk.h>
#include "firetray.h"

int gdk_is_window(void* obj) {
  return GDK_IS_WINDOW(obj) ? 1 : 0;
}

int gtk_is_window(void* obj) {
  return GTK_IS_WINDOW(obj) ? 1 : 0;
}

int gtk_is_widget(void* obj) {
  return GTK_IS_WIDGET(obj) ? 1 : 0;
}

unsigned int gtk_get_major_version(void) {return (unsigned int)gtk_major_version;}
unsigned int gtk_get_minor_version(void) {return (unsigned int)gtk_minor_version;}
unsigned int gtk_get_micro_version(void) {return (unsigned int)gtk_micro_version;}
