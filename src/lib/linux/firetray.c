/* pkg-config --libs --cflags gtk+-2.0 */

#include <gtk/gtk.h>
#include "firetray.h"

int gdk_is_window(void* obj) {
  return GDK_IS_WINDOW(obj) ? 1 : 0;
}
